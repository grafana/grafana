package rest

import (
	"context"
	"errors"
	"fmt"
	"time"

	apiequality "k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Function that will create a dual writer
type DualWriteBuilder func(gr schema.GroupResource, legacy Storage, unified Storage) (Storage, error)

// DualWriter is a storage implementation that writes first to LegacyStorage and then to Storage.
// If writing to LegacyStorage fails, the write to Storage is skipped and the error is returned.
// Storage is used for all read operations.  This is useful as a migration step from SQL based
// legacy storage to a more standard kubernetes backed storage interface.
//
// NOTE: Only values supported by legacy storage will be preserved in the CREATE/UPDATE commands.
// For example, annotations, labels, and managed fields may not be preserved.  Everything in upstream
// storage can be recrated from the data in legacy storage.
//
// The LegacyStorage implementation must implement the following interfaces:
// - rest.Storage
// - rest.TableConvertor
// - rest.Scoper
// - rest.SingularNameProvider
//
// These interfaces are optional, but they all should be implemented to fully support dual writes:
// - rest.Creater
// - rest.Updater
// - rest.GracefulDeleter
// - rest.CollectionDeleter

type DualWriter interface {
	Storage
	Mode() DualWriterMode
}

type DualWriterMode int

const (
	// Mode0 represents writing to and reading from solely LegacyStorage. This mode is enabled when the
	// Unified Storage is disabled. All reads and writes are made to LegacyStorage. None are made to Storage.
	Mode0 DualWriterMode = iota
	// Mode1 represents writing to and reading from LegacyStorage for all primary functionality while additionally
	// reading and writing to Storage on a best effort basis for the sake of collecting metrics.
	Mode1
	// Mode2 is the dual writing mode that represents writing to LegacyStorage and Storage and reading from LegacyStorage.
	// The objects written to storage will include any labels and annotations.
	// When reading values, the results will be from LegacyStorage.
	Mode2
	// Mode3 represents writing to LegacyStorage and Storage and reading from Storage.
	// NOTE: Requesting mode3 will only happen when after a background sync job succeeds
	Mode3
	// Mode4 represents writing and reading from Storage.
	// NOTE: Requesting mode4 will only happen when after a background sync job succeeds
	Mode4
	// Mode5 uses storage regardless of the background sync state
	Mode5
)

type NamespacedKVStore interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

type ServerLockService interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func SetDualWritingMode(
	ctx context.Context,
	kvs NamespacedKVStore,
	cfg *SyncerConfig,
	metrics *DualWriterMetrics,
) (DualWriterMode, error) {
	if cfg == nil {
		return Mode0, errors.New("syncer config is nil")
	}
	// Mode0 means no DualWriter
	if cfg.Mode == Mode0 {
		return Mode0, nil
	}

	toMode := map[string]DualWriterMode{
		// It is not possible to initialize a mode 0 dual writer. Mode 0 represents
		// writing to legacy storage without Unified Storage enabled.
		"1": Mode1,
		"2": Mode2,
		"3": Mode3,
		"4": Mode4,
		"5": Mode5,
	}
	errDualWriterSetCurrentMode := errors.New("failed to set current dual writing mode")

	// Use entity name as key
	kvMode, ok, err := kvs.Get(ctx, cfg.Kind)
	if err != nil {
		return Mode0, errors.New("failed to fetch current dual writing mode")
	}

	currentMode, exists := toMode[kvMode]

	// If the mode does not exist in our mapping, we log an error.
	if !exists && ok {
		// Only log if "ok" because initially all instances will have mode unset for playlists.
		klog.Infof("invalid dual writing mode for %s mode: %v", cfg.Kind, kvMode)
	}

	// If the mode does not exist in our mapping, and we also didn't find an entry for this kind, fallback.
	if !exists || !ok {
		// Default to mode 1
		currentMode = Mode1
		if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(currentMode)); err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
	}

	isUpgradeToReadUnifiedMode := currentMode < Mode3 && cfg.Mode >= Mode3
	if !isUpgradeToReadUnifiedMode {
		if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(cfg.Mode)); err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
		return cfg.Mode, nil
	}

	// If SkipDataSync is enabled, we can set the mode directly without running the syncer.
	if cfg.SkipDataSync {
		if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(cfg.Mode)); err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
		return cfg.Mode, nil
	}

	// Transitioning to Mode3 or higher from Mode0, Mode1, or Mode2.
	// We need to run the syncer in the current mode before we can upgrade to Mode3 or higher.
	cfgModeTmp := cfg.Mode
	// Before running the sync, set the syncer config to the current mode, as we have to run the syncer
	// once in the current active mode before we can upgrade.
	cfg.Mode = currentMode
	syncOk, err := runDataSyncer(ctx, cfg, metrics)
	// Once we are done with running the syncer, we can change the mode back on the config to the desired one.
	cfg.Mode = cfgModeTmp
	if err != nil {
		klog.Error("data syncer failed for mode:", kvMode, "err", err)
		return currentMode, nil
	}
	if !syncOk {
		klog.Info("data syncer not ok for mode:", kvMode)
		return currentMode, nil
	}
	// If sync is successful, update the mode to the desired one.
	if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(cfg.Mode)); err != nil {
		return Mode0, errDualWriterSetCurrentMode
	}
	return cfg.Mode, nil
}

// Compare asserts on the equality of objects returned from both stores	(object storage and legacy storage)
func Compare(objA, objB runtime.Object) bool {
	if objA == nil || objB == nil {
		return objA == nil && objB == nil
	}
	if objA == objB {
		return true
	}
	mA, err := utils.MetaAccessor(objA)
	if err != nil {
		return false
	}
	mB, err := utils.MetaAccessor(objB)
	if err != nil {
		return false
	}
	sA, err := mA.GetSpec()
	if err != nil {
		return false
	}
	sB, err := mB.GetSpec()
	if err != nil {
		return false
	}
	return apiequality.Semantic.DeepEqual(sA, sB)
}
