package rest

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type syncItem struct {
	name            string
	objStorage      runtime.Object
	objLegacy       runtime.Object
	accessorStorage utils.GrafanaMetaAccessor
	accessorLegacy  utils.GrafanaMetaAccessor
}

type SyncerConfig struct {
	Kind        string
	RequestInfo *request.RequestInfo

	Mode              DualWriterMode
	LegacyStorage     Storage
	Storage           Storage
	ServerLockService ServerLockService
	SkipDataSync      bool

	DataSyncerInterval     time.Duration
	DataSyncerRecordsLimit int

	Reg prometheus.Registerer
}

func (s *SyncerConfig) Validate() error {
	if s == nil {
		return fmt.Errorf("syncer config is nil")
	}
	if s.Kind == "" {
		return fmt.Errorf("kind must be specified")
	}
	if s.RequestInfo == nil {
		return fmt.Errorf("requestInfo must be specified")
	}
	if s.ServerLockService == nil {
		return fmt.Errorf("serverLockService must be specified")
	}
	if s.Storage == nil {
		return fmt.Errorf("storage must be specified")
	}
	if s.LegacyStorage == nil {
		return fmt.Errorf("legacy storage must be specified")
	}
	if s.DataSyncerInterval == 0 {
		s.DataSyncerInterval = time.Hour
	}
	if s.DataSyncerRecordsLimit == 0 {
		s.DataSyncerRecordsLimit = 1000
	}
	if s.Reg == nil {
		s.Reg = prometheus.DefaultRegisterer
	}
	return nil
}

// StartPeriodicDataSyncer starts a background job that will execute the DataSyncer, syncing the data
// from the hosted grafana backend into the unified storage backend. This is run in the grafana instance.
func StartPeriodicDataSyncer(ctx context.Context, cfg *SyncerConfig) error {
	if err := cfg.Validate(); err != nil {
		return fmt.Errorf("invalid syncer config: %w", err)
	}

	log := klog.NewKlogr().WithName("legacyToUnifiedStorageDataSyncer").WithValues("mode", cfg.Mode, "resource", cfg.Kind)

	log.Info("Starting periodic data syncer")

	// run in background
	go func() {
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		timeWindow := 600 // 600 seconds (10 minutes)
		jitterSeconds := r.Int63n(int64(timeWindow))
		log.Info("data syncer scheduled", "starting time", time.Now().Add(time.Second*time.Duration(jitterSeconds)))
		time.Sleep(time.Second * time.Duration(jitterSeconds))

		// run it immediately
		syncOK, err := runDataSyncer(ctx, cfg)
		log.Info("data syncer finished", "syncOK", syncOK, "error", err)

		ticker := time.NewTicker(cfg.DataSyncerInterval)
		for {
			select {
			case <-ticker.C:
				syncOK, err = runDataSyncer(ctx, cfg)
				log.Info("data syncer finished", "syncOK", syncOK, ", error", err)
			case <-ctx.Done():
				return
			}
		}
	}()
	return nil
}

// runDataSyncer will ensure that data between legacy storage and unified storage are in sync.
// The sync implementation depends on the DualWriter mode
func runDataSyncer(ctx context.Context, cfg *SyncerConfig) (bool, error) {
	if err := cfg.Validate(); err != nil {
		return false, fmt.Errorf("invalid syncer config: %w", err)
	}
	// ensure that execution takes no longer than necessary
	timeout := cfg.DataSyncerInterval - time.Minute
	ctx, cancelFn := context.WithTimeout(ctx, timeout)
	defer cancelFn()

	// implementation depends on the current DualWriter mode
	switch cfg.Mode {
	case Mode1, Mode2:
		return legacyToUnifiedStorageDataSyncer(ctx, cfg)
	default:
		klog.Info("data syncer not implemented for mode:", cfg.Mode)
		return false, nil
	}
}

func legacyToUnifiedStorageDataSyncer(ctx context.Context, cfg *SyncerConfig) (bool, error) {
	if err := cfg.Validate(); err != nil {
		return false, fmt.Errorf("invalid syncer config: %w", err)
	}
	metrics := &dualWriterMetrics{}
	metrics.init(cfg.Reg)

	log := klog.NewKlogr().WithName("legacyToUnifiedStorageDataSyncer").WithValues("mode", cfg.Mode, "resource", cfg.Kind)

	everythingSynced := false
	outOfSync := 0
	syncSuccess := 0
	syncErr := 0

	maxInterval := cfg.DataSyncerInterval + 5*time.Minute

	var errSync error

	// LockExecuteAndRelease ensures that just a single Grafana server acquires a lock at a time
	// The parameter 'maxInterval' is a timeout safeguard, if the LastExecution in the
	// database is older than maxInterval, we will assume the lock as timeouted. The 'maxInterval' parameter should be so long
	// that is impossible for 2 processes to run at the same time.
	err := cfg.ServerLockService.LockExecuteAndRelease(ctx, fmt.Sprintf("legacyToUnifiedStorageDataSyncer-%d-%s", cfg.Mode, cfg.Kind), maxInterval, func(context.Context) {
		log.Info("starting legacyToUnifiedStorageDataSyncer")
		startSync := time.Now()

		ctx = klog.NewContext(ctx, log)
		ctx, _ = identity.WithServiceIdentity(ctx, 0)
		ctx = request.WithNamespace(ctx, cfg.RequestInfo.Namespace)
		ctx = request.WithRequestInfo(ctx, cfg.RequestInfo)

		storageList, err := getList(ctx, cfg.Storage, &metainternalversion.ListOptions{
			Limit: int64(cfg.DataSyncerRecordsLimit),
		})
		if err != nil {
			log.Error(err, "unable to extract list from storage")
			return
		}

		if len(storageList) >= cfg.DataSyncerRecordsLimit {
			errSync = fmt.Errorf("unified storage has more than %d records. Aborting sync", cfg.DataSyncerRecordsLimit)
			log.Error(errSync, "Unified storage has more records to be synced than allowed")
			return
		}

		log.Info("got items from unified storage", "items", len(storageList))

		legacyList, err := getList(ctx, cfg.LegacyStorage, &metainternalversion.ListOptions{
			Limit: int64(cfg.DataSyncerRecordsLimit),
		})
		if err != nil {
			if len(storageList) == 0 {
				log.Info("legacy storage is empty, skipping sync")
				return
			}
			log.Error(err, "unable to extract list from legacy storage")
			return
		}
		log.Info("got items from legacy storage", "items", len(legacyList))

		itemsByName := map[string]syncItem{}
		for _, obj := range legacyList {
			accessor, err := utils.MetaAccessor(obj)
			if err != nil {
				log.Error(err, "error retrieving accessor data for object from legacy storage")
				continue
			}
			name := accessor.GetName()

			item := itemsByName[name]
			item.name = name
			item.objLegacy = obj
			item.accessorLegacy = accessor
			itemsByName[name] = item
		}

		for _, obj := range storageList {
			accessor, err := utils.MetaAccessor(obj)
			if err != nil {
				log.Error(err, "error retrieving accessor data for object from storage")
				continue
			}
			name := accessor.GetName()

			item := itemsByName[name]
			item.name = name
			item.objStorage = obj
			item.accessorStorage = accessor
			itemsByName[name] = item
		}
		log.Info("got list of items to be synced", "items", len(itemsByName))

		for name, item := range itemsByName {
			// upsert if:
			// - existing in both legacy and storage, but objects are different, or
			// - if it's missing from storage
			if item.objLegacy != nil &&
				(item.objStorage == nil || !Compare(item.objLegacy, item.objStorage)) {
				outOfSync++

				if item.objStorage != nil {
					item.accessorLegacy.SetResourceVersion(item.accessorStorage.GetResourceVersion())
					item.accessorLegacy.SetUID(item.accessorStorage.GetUID())

					log.Info("updating item on unified storage", "name", name)
				} else {
					item.accessorLegacy.SetResourceVersion("")
					item.accessorLegacy.SetUID("")

					log.Info("inserting item on unified storage", "name", name)
				}

				objInfo := rest.DefaultUpdatedObjectInfo(item.objLegacy, []rest.TransformFunc{}...)
				res, _, err := cfg.Storage.Update(ctx,
					name,
					objInfo,
					func(ctx context.Context, obj runtime.Object) error { return nil },
					func(ctx context.Context, obj, old runtime.Object) error { return nil },
					true, // force creation
					&metav1.UpdateOptions{},
				)
				if err != nil {
					log.WithValues("object", res).Error(err, "could not update in storage")
					syncErr++
				} else {
					syncSuccess++
				}
			}

			// delete if object does not exists on legacy but exists on storage
			if item.objLegacy == nil && item.objStorage != nil {
				outOfSync++

				ctx = request.WithRequestInfo(ctx, &request.RequestInfo{
					APIGroup:  cfg.RequestInfo.APIGroup,
					Resource:  cfg.RequestInfo.Resource,
					Name:      name,
					Namespace: cfg.RequestInfo.Namespace,
				})

				log.Info("deleting item from unified storage", "name", name)

				deletedS, _, err := cfg.Storage.Delete(ctx, name, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
				if err != nil && !apierrors.IsNotFound(err) {
					log.WithValues("objectList", deletedS).Error(err, "could not delete from storage")
					syncErr++
					continue
				}

				syncSuccess++
			}
		}

		everythingSynced = outOfSync == syncSuccess

		metrics.recordDataSyncerOutcome(cfg.Mode, cfg.Kind, everythingSynced)
		metrics.recordDataSyncerDuration(err != nil, cfg.Mode, cfg.Kind, startSync)

		log.Info("finished syncing items", "items", len(itemsByName), "updated", syncSuccess, "failed", syncErr, "outcome", everythingSynced)
	})

	if errSync != nil {
		err = errSync
	}

	return everythingSynced, err
}

func getList(ctx context.Context, obj rest.Lister, listOptions *metainternalversion.ListOptions) ([]runtime.Object, error) {
	var allItems []runtime.Object

	for {
		if int64(len(allItems)) >= listOptions.Limit {
			return nil, fmt.Errorf("list has more than %d records. Aborting sync", listOptions.Limit)
		}

		ll, err := obj.List(ctx, listOptions)
		if err != nil {
			return nil, err
		}

		items, err := meta.ExtractList(ll)
		if err != nil {
			return nil, err
		}

		allItems = append(allItems, items...)

		// Get continue token from the list metadata.
		listMeta, err := meta.ListAccessor(ll)
		if err != nil {
			return nil, err
		}

		// If no continue token, we're done paginating.
		if listMeta.GetContinue() == "" {
			break
		}

		// Set continue token for next page.
		listOptions.Continue = listMeta.GetContinue()
	}

	return allItems, nil
}
