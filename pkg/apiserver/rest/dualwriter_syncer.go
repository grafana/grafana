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

	"github.com/grafana/authlib/claims"
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

const dataSyncerInterval = 60 * time.Minute

// StartPeriodicDataSyncer starts a background job that will execute the DataSyncer every 60 minutes
func StartPeriodicDataSyncer(ctx context.Context, mode DualWriterMode, legacy LegacyStorage, storage Storage,
	kind string, reg prometheus.Registerer, serverLockService ServerLockService, requestInfo *request.RequestInfo) {
	log := klog.NewKlogr().WithName("legacyToUnifiedStorageDataSyncer").WithValues("mode", mode, "resource", kind)

	log.Info("Starting periodic data syncer")

	// run in background
	go func() {
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		timeWindow := 600 // 600 seconds (10 minutes)
		jitterSeconds := r.Int63n(int64(timeWindow))
		log.Info("data syncer scheduled", "starting time", time.Now().Add(time.Second*time.Duration(jitterSeconds)))
		time.Sleep(time.Second * time.Duration(jitterSeconds))

		// run it immediately
		syncOK, err := runDataSyncer(ctx, mode, legacy, storage, kind, reg, serverLockService, requestInfo)
		log.Info("data syncer finished", "syncOK", syncOK, "error", err)

		ticker := time.NewTicker(dataSyncerInterval)
		for {
			select {
			case <-ticker.C:
				syncOK, err = runDataSyncer(ctx, mode, legacy, storage, kind, reg, serverLockService, requestInfo)
				log.Info("data syncer finished", "syncOK", syncOK, ", error", err)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// runDataSyncer will ensure that data between legacy storage and unified storage are in sync.
// The sync implementation depends on the DualWriter mode
func runDataSyncer(ctx context.Context, mode DualWriterMode, legacy LegacyStorage, storage Storage,
	kind string, reg prometheus.Registerer, serverLockService ServerLockService, requestInfo *request.RequestInfo) (bool, error) {
	// ensure that execution takes no longer than necessary
	const timeout = dataSyncerInterval - time.Minute
	ctx, cancelFn := context.WithTimeout(ctx, timeout)
	defer cancelFn()

	// implementation depends on the current DualWriter mode
	switch mode {
	case Mode1, Mode2:
		return legacyToUnifiedStorageDataSyncer(ctx, mode, legacy, storage, kind, reg, serverLockService, requestInfo)
	default:
		klog.Info("data syncer not implemented for mode mode:", mode)
		return false, nil
	}
}

func legacyToUnifiedStorageDataSyncer(ctx context.Context, mode DualWriterMode, legacy LegacyStorage, storage Storage, resource string, reg prometheus.Registerer, serverLockService ServerLockService, requestInfo *request.RequestInfo) (bool, error) {
	metrics := &dualWriterMetrics{}
	metrics.init(reg)

	log := klog.NewKlogr().WithName("legacyToUnifiedStorageDataSyncer").WithValues("mode", mode, "resource", resource)

	everythingSynced := false
	outOfSync := 0
	syncSuccess := 0
	syncErr := 0

	maxInterval := dataSyncerInterval + 5*time.Minute

	var errSync error
	const maxRecordsSync = 1000

	// LockExecuteAndRelease ensures that just a single Grafana server acquires a lock at a time
	// The parameter 'maxInterval' is a timeout safeguard, if the LastExecution in the
	// database is older than maxInterval, we will assume the lock as timeouted. The 'maxInterval' parameter should be so long
	// that is impossible for 2 processes to run at the same time.
	err := serverLockService.LockExecuteAndRelease(ctx, fmt.Sprintf("legacyToUnifiedStorageDataSyncer-%d-%s", mode, resource), maxInterval, func(context.Context) {
		log.Info("starting legacyToUnifiedStorageDataSyncer")
		startSync := time.Now()

		orgId := int64(1)

		ctx = klog.NewContext(ctx, log)
		ctx = identity.WithRequester(ctx, getSyncRequester(orgId))
		ctx = request.WithNamespace(ctx, requestInfo.Namespace)
		ctx = request.WithRequestInfo(ctx, requestInfo)

		storageList, err := getList(ctx, storage, &metainternalversion.ListOptions{
			Limit: maxRecordsSync,
		})
		if err != nil {
			log.Error(err, "unable to extract list from storage")
			return
		}

		if len(storageList) >= maxRecordsSync {
			errSync = fmt.Errorf("unified storage has more than %d records. Aborting sync", maxRecordsSync)
			log.Error(errSync, "Unified storage has more records to be synced than allowed")
			return
		}

		log.Info("got items from unified storage", "items", len(storageList))

		legacyList, err := getList(ctx, legacy, &metainternalversion.ListOptions{})
		if err != nil {
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
				res, _, err := storage.Update(ctx,
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
					APIGroup:  requestInfo.APIGroup,
					Resource:  requestInfo.Resource,
					Name:      name,
					Namespace: requestInfo.Namespace,
				})

				log.Info("deleting item from unified storage", "name", name)

				deletedS, _, err := storage.Delete(ctx, name, func(ctx context.Context, obj runtime.Object) error { return nil }, &metav1.DeleteOptions{})
				if err != nil && !apierrors.IsNotFound(err) {
					log.WithValues("objectList", deletedS).Error(err, "could not delete from storage")
					syncErr++
					continue
				}

				syncSuccess++
			}
		}

		everythingSynced = outOfSync == syncSuccess

		metrics.recordDataSyncerOutcome(mode, resource, everythingSynced)
		metrics.recordDataSyncerDuration(err != nil, mode, resource, startSync)

		log.Info("finished syncing items", "items", len(itemsByName), "updated", syncSuccess, "failed", syncErr, "outcome", everythingSynced)
	})

	if errSync != nil {
		err = errSync
	}

	return everythingSynced, err
}

func getSyncRequester(orgId int64) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:           claims.TypeServiceAccount, // system:apiserver
		UserID:         1,
		OrgID:          orgId,
		Name:           "admin",
		Login:          "admin",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
		Permissions: map[int64]map[string][]string{
			orgId: {
				"*": {"*"}, // all resources, all scopes
			},
		},
	}
}

func getList(ctx context.Context, obj rest.Lister, listOptions *metainternalversion.ListOptions) ([]runtime.Object, error) {
	ll, err := obj.List(ctx, listOptions)
	if err != nil {
		return nil, err
	}

	return meta.ExtractList(ll)
}
