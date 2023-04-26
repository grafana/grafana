package searchV2

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/blugelabs/bluge"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
	kdash "github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/setting"
)

type dashboardLoader interface {
	// LoadDashboards returns slice of dashboards. If dashboardUID is empty – then
	// implementation must return all dashboards in instance to build an entire
	// dashboard index for an organization. If dashboardUID is not empty – then only
	// return dashboard with specified UID or empty slice if not found (this is required
	// to apply partial update).
	LoadDashboards(ctx context.Context, orgID int64, dashboardUID string) ([]dashboard, error)
}

type eventStore interface {
	GetLastEvent(ctx context.Context) (*store.EntityEvent, error)
	GetAllEventsAfter(ctx context.Context, id int64) ([]*store.EntityEvent, error)
}

// While we migrate away from internal IDs... this lets us lookup values in SQL
// NOTE: folderId is unique across all orgs
type folderUIDLookup = func(ctx context.Context, folderId int64) (string, error)

type dashboard struct {
	id       int64
	uid      string
	isFolder bool
	folderID int64
	slug     string
	created  time.Time
	updated  time.Time

	// Use generic structure
	summary *entity.EntitySummary
}

// buildSignal is sent when search index is accessed in organization for which
// we have not constructed an index yet.
type buildSignal struct {
	orgID int64
	done  chan error
}

type orgIndex struct {
	writers map[indexType]*bluge.Writer
}

type indexType string

const (
	indexTypeDashboard indexType = "dashboard"
)

func (i *orgIndex) writerForIndex(idxType indexType) *bluge.Writer {
	return i.writers[idxType]
}

func (i *orgIndex) readerForIndex(idxType indexType) (*bluge.Reader, func(), error) {
	reader, err := i.writers[idxType].Reader()
	if err != nil {
		return nil, nil, err
	}
	return reader, func() { _ = reader.Close() }, nil
}

type searchIndex struct {
	mu                      sync.RWMutex
	loader                  dashboardLoader
	perOrgIndex             map[int64]*orgIndex
	initializedOrgs         map[int64]bool
	initialIndexingComplete bool
	initializationMutex     sync.RWMutex
	eventStore              eventStore
	logger                  log.Logger
	buildSignals            chan buildSignal
	extender                DocumentExtender
	folderIdLookup          folderUIDLookup
	syncCh                  chan chan struct{}
	tracer                  tracing.Tracer
	features                featuremgmt.FeatureToggles
	settings                setting.SearchSettings
}

func newSearchIndex(dashLoader dashboardLoader, evStore eventStore, extender DocumentExtender, folderIDs folderUIDLookup, tracer tracing.Tracer, features featuremgmt.FeatureToggles, settings setting.SearchSettings) *searchIndex {
	return &searchIndex{
		loader:          dashLoader,
		eventStore:      evStore,
		perOrgIndex:     map[int64]*orgIndex{},
		initializedOrgs: map[int64]bool{},
		logger:          log.New("searchIndex"),
		buildSignals:    make(chan buildSignal),
		extender:        extender,
		folderIdLookup:  folderIDs,
		syncCh:          make(chan chan struct{}),
		tracer:          tracer,
		features:        features,
		settings:        settings,
	}
}

func (i *searchIndex) isInitialized(_ context.Context, orgId int64) IsSearchReadyResponse {
	i.initializationMutex.RLock()
	orgInitialized := i.initializedOrgs[orgId]
	initialInitComplete := i.initialIndexingComplete
	i.initializationMutex.RUnlock()

	if orgInitialized && initialInitComplete {
		return IsSearchReadyResponse{IsReady: true}
	}

	if !initialInitComplete {
		return IsSearchReadyResponse{IsReady: false, Reason: "initial-indexing-ongoing"}
	}

	i.triggerBuildingOrgIndex(orgId)
	return IsSearchReadyResponse{IsReady: false, Reason: "org-indexing-ongoing"}
}

func (i *searchIndex) triggerBuildingOrgIndex(orgId int64) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		doneIndexing := make(chan error, 1)
		signal := buildSignal{orgID: orgId, done: doneIndexing}
		select {
		case i.buildSignals <- signal:
		case <-ctx.Done():
			i.logger.Warn("Failed to send a build signal to initialize org index", "orgId", orgId)
			return
		}
		select {
		case err := <-doneIndexing:
			if err != nil {
				i.logger.Error("Failed to build org index", "orgId", orgId, "error", err)
			} else {
				i.logger.Debug("Successfully built org index", "orgId", orgId)
			}
		case <-ctx.Done():
			i.logger.Warn("Building org index timeout", "orgId", orgId)
		}
	}()
}

func (i *searchIndex) sync(ctx context.Context) error {
	doneCh := make(chan struct{}, 1)
	select {
	case i.syncCh <- doneCh:
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case <-doneCh:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (i *searchIndex) run(ctx context.Context, orgIDs []int64, reIndexSignalCh chan struct{}) error {
	i.logger.Info("Initializing SearchV2", "dashboardLoadingBatchSize", i.settings.DashboardLoadingBatchSize, "fullReindexInterval", i.settings.FullReindexInterval, "indexUpdateInterval", i.settings.IndexUpdateInterval)
	initialSetupCtx, initialSetupSpan := i.tracer.Start(ctx, "searchV2 initialSetup")

	reIndexInterval := i.settings.FullReindexInterval
	fullReIndexTimer := time.NewTimer(reIndexInterval)
	defer fullReIndexTimer.Stop()

	partialUpdateInterval := i.settings.IndexUpdateInterval
	partialUpdateTimer := time.NewTimer(partialUpdateInterval)
	defer partialUpdateTimer.Stop()

	var lastEventID int64
	lastEvent, err := i.eventStore.GetLastEvent(initialSetupCtx)
	if err != nil {
		initialSetupSpan.End()
		return err
	}
	if lastEvent != nil {
		lastEventID = lastEvent.Id
	}

	err = i.buildInitialIndexes(initialSetupCtx, orgIDs)
	if err != nil {
		initialSetupSpan.End()
		return err
	}

	// This semaphore channel allows limiting concurrent async re-indexing routines to 1.
	asyncReIndexSemaphore := make(chan struct{}, 1)

	// Channel to handle signals about asynchronous full re-indexing completion.
	reIndexDoneCh := make(chan int64, 1)

	i.initializationMutex.Lock()
	i.initialIndexingComplete = true
	i.initializationMutex.Unlock()

	initialSetupSpan.End()

	for {
		select {
		case doneCh := <-i.syncCh:
			// Executed on search read requests to make sure index is consistent.
			lastEventID = i.applyIndexUpdates(ctx, lastEventID)
			close(doneCh)
		case <-partialUpdateTimer.C:
			// Periodically apply updates collected in entity events table.
			partialIndexUpdateCtx, span := i.tracer.Start(ctx, "searchV2 partial update timer")
			lastEventID = i.applyIndexUpdates(partialIndexUpdateCtx, lastEventID)
			span.End()
			partialUpdateTimer.Reset(partialUpdateInterval)
		case <-reIndexSignalCh:
			// External systems may trigger re-indexing, at this moment provisioning does this.
			i.logger.Info("Full re-indexing due to external signal")
			fullReIndexTimer.Reset(0)
		case signal := <-i.buildSignals:
			buildSignalCtx, span := i.tracer.Start(ctx, "searchV2 build signal")

			// When search read request meets new not-indexed org we build index for it.
			i.mu.RLock()
			_, ok := i.perOrgIndex[signal.orgID]
			if ok {
				span.End()
				// Index for org already exists, do nothing.
				i.mu.RUnlock()
				close(signal.done)
				continue
			}
			i.mu.RUnlock()
			lastIndexedEventID := lastEventID
			// Prevent full re-indexing while we are building index for new org.
			// Full re-indexing will be later re-started in `case lastIndexedEventID := <-reIndexDoneCh`
			// branch.
			fullReIndexTimer.Stop()
			go func() {
				defer span.End()
				// We need semaphore here since asynchronous re-indexing may be in progress already.
				asyncReIndexSemaphore <- struct{}{}
				defer func() { <-asyncReIndexSemaphore }()
				_, err = i.buildOrgIndex(buildSignalCtx, signal.orgID)
				signal.done <- err
				reIndexDoneCh <- lastIndexedEventID
			}()
		case <-fullReIndexTimer.C:
			fullReindexCtx, span := i.tracer.Start(ctx, "searchV2 full reindex timer")

			// Periodically rebuild indexes since we could miss updates. At this moment we are issuing
			// entity events non-atomically (outside of transaction) and do not cover all possible dashboard
			// change places, so periodic re-indexing fixes possibly broken state. But ideally we should
			// come to an approach which does not require periodic re-indexing at all. One possible way
			// is to use DB triggers, see https://github.com/grafana/grafana/pull/47712.
			lastIndexedEventID := lastEventID
			go func() {
				defer span.End()
				// Do full re-index asynchronously to avoid blocking index synchronization
				// on read for a long time.

				// We need semaphore here since re-indexing due to build signal may be in progress already.
				asyncReIndexSemaphore <- struct{}{}
				defer func() { <-asyncReIndexSemaphore }()

				started := time.Now()
				i.logger.Info("Start re-indexing", i.withCtxData(fullReindexCtx)...)
				i.reIndexFromScratch(fullReindexCtx)
				i.logger.Info("Full re-indexing finished", i.withCtxData(fullReindexCtx, "fullReIndexElapsed", time.Since(started))...)
				reIndexDoneCh <- lastIndexedEventID
			}()
		case lastIndexedEventID := <-reIndexDoneCh:
			// Asynchronous re-indexing is finished. Set lastEventID to the value which
			// was actual at the re-indexing start – so that we could re-apply all the
			// events happened during async index build process and make sure it's consistent.
			if lastEventID != lastIndexedEventID {
				i.logger.Info("Re-apply event ID to last indexed", "currentEventID", lastEventID, "lastIndexedEventID", lastIndexedEventID)
				lastEventID = lastIndexedEventID
				// Apply events immediately.
				partialUpdateTimer.Reset(0)
			}
			fullReIndexTimer.Reset(reIndexInterval)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *searchIndex) buildInitialIndexes(ctx context.Context, orgIDs []int64) error {
	started := time.Now()
	i.logger.Info("Start building in-memory indexes")
	for _, orgID := range orgIDs {
		err := i.buildInitialIndex(ctx, orgID)
		if err != nil {
			return fmt.Errorf("can't build initial dashboard search index for org %d: %w", orgID, err)
		}
	}
	i.logger.Info("Finish building in-memory indexes", "elapsed", time.Since(started))
	return nil
}

func (i *searchIndex) buildInitialIndex(ctx context.Context, orgID int64) error {
	debugCtx, debugCtxCancel := context.WithCancel(ctx)
	if os.Getenv("GF_SEARCH_DEBUG") != "" {
		go i.debugResourceUsage(debugCtx, 200*time.Millisecond)
	}

	started := time.Now()
	numDashboards, err := i.buildOrgIndex(ctx, orgID)
	if err != nil {
		debugCtxCancel()
		return fmt.Errorf("can't build dashboard search index for org ID 1: %w", err)
	}
	i.logger.Info("Indexing for org finished", "orgIndexElapsed", time.Since(started), "orgId", orgID, "numDashboards", numDashboards)
	debugCtxCancel()

	if os.Getenv("GF_SEARCH_DEBUG") != "" {
		// May help to estimate size of index when introducing changes. Though it's not a direct
		// match to a memory consumption, but at least make give some relative difference understanding.
		// Moreover, changes in indexing can cause additional memory consumption upon initial index build
		// which is not reflected here.
		i.reportSizeOfIndexDiskBackup(orgID)
	}
	return nil
}

// This is a naive implementation of process CPU getting (credits to
// https://stackoverflow.com/a/11357813/1288429). Should work on both Linux and Darwin.
// Since we only use this during development – seems simple and cheap solution to get
// process CPU usage in cross-platform way.
func getProcessCPU(currentPid int) (float64, error) {
	cmd := exec.Command("ps", "aux")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return 0, err
	}
	for {
		line, err := out.ReadString('\n')
		if err != nil {
			break
		}
		tokens := strings.Split(line, " ")
		ft := make([]string, 0)
		for _, t := range tokens {
			if t != "" && t != "\t" {
				ft = append(ft, t)
			}
		}
		pid, err := strconv.Atoi(ft[1])
		if err != nil {
			continue
		}
		if pid != currentPid {
			continue
		}
		cpu, err := strconv.ParseFloat(ft[2], 64)
		if err != nil {
			return 0, err
		}
		return cpu, nil
	}
	return 0, errors.New("process not found")
}

func (i *searchIndex) debugResourceUsage(ctx context.Context, frequency time.Duration) {
	var maxHeapInuse uint64
	var maxSys uint64

	captureMemStats := func() {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		if m.HeapInuse > maxHeapInuse {
			maxHeapInuse = m.HeapInuse
		}
		if m.Sys > maxSys {
			maxSys = m.Sys
		}
	}

	var cpuUtilization []float64

	captureCPUStats := func() {
		cpu, err := getProcessCPU(os.Getpid())
		if err != nil {
			i.logger.Error("CPU stats error", "error", err)
			return
		}
		// Just collect CPU utilization to a slice and show in the of index build.
		cpuUtilization = append(cpuUtilization, cpu)
	}

	captureMemStats()
	captureCPUStats()

	for {
		select {
		case <-ctx.Done():
			i.logger.Warn("Resource usage during indexing", "maxHeapInUse", formatBytes(maxHeapInuse), "maxSys", formatBytes(maxSys), "cpuPercent", cpuUtilization)
			return
		case <-time.After(frequency):
			captureMemStats()
			captureCPUStats()
		}
	}
}

func (i *searchIndex) reportSizeOfIndexDiskBackup(orgID int64) {
	index, _ := i.getOrgIndex(orgID)
	reader, cancel, err := index.readerForIndex(indexTypeDashboard)
	if err != nil {
		i.logger.Warn("Error getting reader", "error", err)
		return
	}
	defer cancel()

	// create a temp directory to store the index
	tmpDir, err := os.MkdirTemp("", "grafana.dashboard_index")
	if err != nil {
		i.logger.Error("can't create temp dir", "error", err)
		return
	}
	defer func() {
		err := os.RemoveAll(tmpDir)
		if err != nil {
			i.logger.Error("can't remove temp dir", "error", err, "tmpDir", tmpDir)
			return
		}
	}()

	cancelCh := make(chan struct{})
	err = reader.Backup(tmpDir, cancelCh)
	if err != nil {
		i.logger.Error("can't create index disk backup", "error", err)
		return
	}

	size, err := dirSize(tmpDir)
	if err != nil {
		i.logger.Error("can't calculate dir size", "error", err)
		return
	}

	i.logger.Warn("Size of index disk backup", "size", formatBytes(uint64(size)))
}

func (i *searchIndex) buildOrgIndex(ctx context.Context, orgID int64) (int, error) {
	spanCtx, span := i.tracer.Start(ctx, "searchV2 buildOrgIndex")
	span.SetAttributes("org_id", orgID, attribute.Key("org_id").Int64(orgID))

	started := time.Now()
	ctx, cancel := context.WithTimeout(spanCtx, time.Minute)
	ctx = log.InitCounter(ctx)

	defer func() {
		span.End()
		cancel()
	}()

	i.logger.Info("Start building org index", "orgId", orgID)
	dashboards, err := i.loader.LoadDashboards(ctx, orgID, "")
	orgSearchIndexLoadTime := time.Since(started)

	if err != nil {
		return 0, fmt.Errorf("error loading dashboards: %w, elapsed: %s", err, orgSearchIndexLoadTime.String())
	}
	i.logger.Info("Finish loading org dashboards", "elapsed", orgSearchIndexLoadTime, "orgId", orgID)

	dashboardExtender := i.extender.GetDashboardExtender(orgID)

	_, initOrgIndexSpan := i.tracer.Start(ctx, "searchV2 buildOrgIndex init org index")
	initOrgIndexSpan.SetAttributes("org_id", orgID, attribute.Key("org_id").Int64(orgID))
	initOrgIndexSpan.SetAttributes("dashboardCount", len(dashboards), attribute.Key("dashboardCount").Int(len(dashboards)))

	index, err := initOrgIndex(dashboards, i.logger, dashboardExtender)

	initOrgIndexSpan.End()

	if err != nil {
		return 0, fmt.Errorf("error initializing index: %w", err)
	}
	orgSearchIndexTotalTime := time.Since(started)
	orgSearchIndexBuildTime := orgSearchIndexTotalTime - orgSearchIndexLoadTime

	i.logger.Info("Re-indexed dashboards for organization",
		i.withCtxData(ctx, "orgId", orgID,
			"orgSearchIndexLoadTime", orgSearchIndexLoadTime,
			"orgSearchIndexBuildTime", orgSearchIndexBuildTime,
			"orgSearchIndexTotalTime", orgSearchIndexTotalTime,
			"orgSearchDashboardCount", len(dashboards))...)

	i.mu.Lock()
	if oldIndex, ok := i.perOrgIndex[orgID]; ok {
		for _, w := range oldIndex.writers {
			_ = w.Close()
		}
	}
	i.perOrgIndex[orgID] = index
	i.mu.Unlock()

	i.initializationMutex.Lock()
	i.initializedOrgs[orgID] = true
	i.initializationMutex.Unlock()

	if orgID == 1 {
		go func() {
			if reader, cancel, err := index.readerForIndex(indexTypeDashboard); err == nil {
				defer cancel()
				updateUsageStats(context.Background(), reader, i.logger, i.tracer)
			}
		}()
	}
	return len(dashboards), nil
}

func (i *searchIndex) getOrgIndex(orgID int64) (*orgIndex, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	r, ok := i.perOrgIndex[orgID]
	return r, ok
}

func (i *searchIndex) getOrCreateOrgIndex(ctx context.Context, orgID int64) (*orgIndex, error) {
	index, ok := i.getOrgIndex(orgID)
	if !ok {
		// For non-main organization indexes are built lazily.
		// If we don't have an index then we are blocking here until an index for
		// an organization is ready. This actually takes time only during the first
		// access, all the consequent search requests do not fall into this branch.
		doneIndexing := make(chan error, 1)
		signal := buildSignal{orgID: orgID, done: doneIndexing}
		select {
		case i.buildSignals <- signal:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		select {
		case err := <-doneIndexing:
			if err != nil {
				return nil, err
			}
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		index, _ = i.getOrgIndex(orgID)
	}
	return index, nil
}

func (i *searchIndex) reIndexFromScratch(ctx context.Context) {
	i.mu.RLock()
	orgIDs := make([]int64, 0, len(i.perOrgIndex))
	for orgID := range i.perOrgIndex {
		orgIDs = append(orgIDs, orgID)
	}
	i.mu.RUnlock()

	for _, orgID := range orgIDs {
		_, err := i.buildOrgIndex(ctx, orgID)
		if err != nil {
			i.logger.Error("Error re-indexing dashboards for organization", "orgId", orgID, "error", err)
			continue
		}
	}
}

func (i *searchIndex) withCtxData(ctx context.Context, params ...interface{}) []interface{} {
	traceID := tracing.TraceIDFromContext(ctx, false)
	if traceID != "" {
		params = append(params, "traceID", traceID)
	}

	if i.features.IsEnabled(featuremgmt.FlagDatabaseMetrics) {
		params = append(params, "db_call_count", log.TotalDBCallCount(ctx))
	}

	return params
}

func (i *searchIndex) applyIndexUpdates(ctx context.Context, lastEventID int64) int64 {
	ctx = log.InitCounter(ctx)
	events, err := i.eventStore.GetAllEventsAfter(ctx, lastEventID)
	if err != nil {
		i.logger.Error("can't load events", "error", err)
		return lastEventID
	}
	if len(events) == 0 {
		return lastEventID
	}
	started := time.Now()
	for _, e := range events {
		err := i.applyEventOnIndex(ctx, e)
		if err != nil {
			i.logger.Error("can't apply event", "error", err)
			return lastEventID
		}
		lastEventID = e.Id
	}
	i.logger.Info("Index updates applied", i.withCtxData(ctx, "indexEventsAppliedElapsed", time.Since(started), "numEvents", len(events))...)
	return lastEventID
}

func (i *searchIndex) applyEventOnIndex(ctx context.Context, e *store.EntityEvent) error {
	i.logger.Debug("processing event", "event", e)

	if !strings.HasPrefix(e.EntityId, "database/") {
		i.logger.Warn("unknown storage", "entityId", e.EntityId)
		return nil
	}
	// database/org/entityType/path*
	parts := strings.SplitN(strings.TrimPrefix(e.EntityId, "database/"), "/", 3)
	if len(parts) != 3 {
		i.logger.Error("can't parse entityId", "entityId", e.EntityId)
		return nil
	}
	orgIDStr := parts[0]
	orgID, err := strconv.ParseInt(orgIDStr, 10, 64)
	if err != nil {
		i.logger.Error("can't extract org ID", "entityId", e.EntityId)
		return nil
	}
	kind := store.EntityType(parts[1])
	uid := parts[2]
	return i.applyEvent(ctx, orgID, kind, uid, e.EventType)
}

func (i *searchIndex) applyEvent(ctx context.Context, orgID int64, kind store.EntityType, uid string, _ store.EntityEventType) error {
	i.mu.Lock()
	_, ok := i.perOrgIndex[orgID]
	if !ok {
		// Skip event for org not yet indexed.
		i.mu.Unlock()
		return nil
	}
	i.mu.Unlock()

	// Both dashboard and folder share same DB table.
	dbDashboards, err := i.loader.LoadDashboards(ctx, orgID, uid)
	if err != nil {
		return err
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	index, ok := i.perOrgIndex[orgID]
	if !ok {
		// Skip event for org not yet fully indexed.
		return nil
	}

	// In the future we can rely on operation types to reduce work here.
	if len(dbDashboards) == 0 {
		switch kind {
		case store.EntityTypeDashboard:
			err = i.removeDashboard(ctx, index, uid)
		case store.EntityTypeFolder:
			err = i.removeFolder(ctx, index, uid)
		default:
			return nil
		}
	} else {
		err = i.updateDashboard(ctx, orgID, index, dbDashboards[0])
	}
	if err != nil {
		return err
	}
	return nil
}

func (i *searchIndex) removeDashboard(_ context.Context, index *orgIndex, dashboardUID string) error {
	dashboardLocation, ok, err := getDashboardLocation(index, dashboardUID)
	if err != nil {
		return err
	}
	if !ok {
		// No dashboard, nothing to remove.
		return nil
	}

	// Find all panel docs to remove with dashboard.
	panelLocation := dashboardUID
	if dashboardLocation != "" {
		panelLocation = dashboardLocation + "/" + dashboardUID
	}
	panelIDs, err := getDocsIDsByLocationPrefix(index, panelLocation)
	if err != nil {
		return err
	}

	writer := index.writerForIndex(indexTypeDashboard)

	batch := bluge.NewBatch()
	batch.Delete(bluge.NewDocument(dashboardUID).ID())
	for _, panelID := range panelIDs {
		batch.Delete(bluge.NewDocument(panelID).ID())
	}

	return writer.Batch(batch)
}

func (i *searchIndex) removeFolder(_ context.Context, index *orgIndex, folderUID string) error {
	ids, err := getDocsIDsByLocationPrefix(index, folderUID)
	if err != nil {
		return fmt.Errorf("error getting by location prefix: %w", err)
	}

	batch := bluge.NewBatch()
	batch.Delete(bluge.NewDocument(folderUID).ID())
	for _, id := range ids {
		batch.Delete(bluge.NewDocument(id).ID())
	}
	writer := index.writerForIndex(indexTypeDashboard)
	return writer.Batch(batch)
}

func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

func (i *searchIndex) updateDashboard(ctx context.Context, orgID int64, index *orgIndex, dash dashboard) error {
	extendDoc := i.extender.GetDashboardExtender(orgID, dash.uid)

	writer := index.writerForIndex(indexTypeDashboard)

	var doc *bluge.Document
	if dash.isFolder {
		doc = getFolderDashboardDoc(dash)
		if err := extendDoc(dash.uid, doc); err != nil {
			return err
		}
		return writer.Update(doc.ID(), doc)
	}

	batch := bluge.NewBatch()

	var folderUID string
	if dash.folderID == 0 {
		folderUID = folder.GeneralFolderUID
	} else {
		var err error
		folderUID, err = i.folderIdLookup(ctx, dash.folderID)
		if err != nil {
			return err
		}
	}

	location := folderUID
	doc = getNonFolderDashboardDoc(dash, location)
	if err := extendDoc(dash.uid, doc); err != nil {
		return err
	}

	if location != "" {
		location += "/"
	}
	location += dash.uid
	panelDocs := getDashboardPanelDocs(dash, location)
	actualPanelIDs := make([]string, 0, len(panelDocs))
	for _, panelDoc := range panelDocs {
		actualPanelIDs = append(actualPanelIDs, string(panelDoc.ID().Term()))
		batch.Update(panelDoc.ID(), panelDoc)
	}

	indexedPanelIDs, err := getDashboardPanelIDs(index, location)
	if err != nil {
		return err
	}

	for _, panelID := range indexedPanelIDs {
		if !stringInSlice(panelID, actualPanelIDs) {
			batch.Delete(bluge.NewDocument(panelID).ID())
		}
	}

	batch.Update(doc.ID(), doc)

	return writer.Batch(batch)
}

type sqlDashboardLoader struct {
	sql      db.DB
	logger   log.Logger
	tracer   tracing.Tracer
	settings setting.SearchSettings
}

func newSQLDashboardLoader(sql db.DB, tracer tracing.Tracer, settings setting.SearchSettings) *sqlDashboardLoader {
	return &sqlDashboardLoader{sql: sql, logger: log.New("sqlDashboardLoader"), tracer: tracer, settings: settings}
}

type dashboardsRes struct {
	dashboards []*dashboardQueryResult
	err        error
}

func (l sqlDashboardLoader) loadAllDashboards(ctx context.Context, limit int, orgID int64, dashboardUID string) chan *dashboardsRes {
	ch := make(chan *dashboardsRes, 3)

	go func() {
		defer close(ch)

		var lastID int64
		for {
			select {
			case <-ctx.Done():
				err := ctx.Err()
				if err != nil {
					ch <- &dashboardsRes{
						dashboards: nil,
						err:        err,
					}
				}
				return
			default:
			}

			dashboardQueryCtx, dashboardQuerySpan := l.tracer.Start(ctx, "sqlDashboardLoader dashboardQuery")
			dashboardQuerySpan.SetAttributes("orgID", orgID, attribute.Key("orgID").Int64(orgID))
			dashboardQuerySpan.SetAttributes("dashboardUID", dashboardUID, attribute.Key("dashboardUID").String(dashboardUID))
			dashboardQuerySpan.SetAttributes("lastID", lastID, attribute.Key("lastID").Int64(lastID))

			rows := make([]*dashboardQueryResult, 0)
			err := l.sql.WithDbSession(dashboardQueryCtx, func(sess *db.Session) error {
				sess.Table("dashboard").
					Where("org_id = ?", orgID)

				if lastID > 0 {
					sess.Where("id > ?", lastID)
				}

				if dashboardUID != "" {
					sess.Where("uid = ?", dashboardUID)
				}

				sess.Cols("id", "uid", "is_folder", "folder_id", "data", "slug", "created", "updated")

				sess.OrderBy("id ASC")
				sess.Limit(limit)

				return sess.Find(&rows)
			})

			dashboardQuerySpan.End()

			if err != nil || len(rows) < limit || dashboardUID != "" {
				ch <- &dashboardsRes{
					dashboards: rows,
					err:        err,
				}
				break
			}

			ch <- &dashboardsRes{
				dashboards: rows,
			}

			if len(rows) > 0 {
				lastID = rows[len(rows)-1].Id
			}
		}
	}()

	return ch
}

func (l sqlDashboardLoader) LoadDashboards(ctx context.Context, orgID int64, dashboardUID string) ([]dashboard, error) {
	ctx, span := l.tracer.Start(ctx, "sqlDashboardLoader LoadDashboards")
	span.SetAttributes("orgID", orgID, attribute.Key("orgID").Int64(orgID))

	defer span.End()

	var dashboards []dashboard

	limit := 1

	if dashboardUID == "" {
		limit = l.settings.DashboardLoadingBatchSize
		dashboards = make([]dashboard, 0, limit)
	}

	loadDatasourceCtx, loadDatasourceSpan := l.tracer.Start(ctx, "sqlDashboardLoader LoadDatasourceLookup")
	loadDatasourceSpan.SetAttributes("orgID", orgID, attribute.Key("orgID").Int64(orgID))

	// key will allow name or uid
	lookup, err := kdash.LoadDatasourceLookup(loadDatasourceCtx, orgID, l.sql)
	if err != nil {
		loadDatasourceSpan.End()
		return dashboards, err
	}
	loadDatasourceSpan.End()

	loadingDashboardCtx, cancelLoadingDashboardCtx := context.WithCancel(ctx)
	defer cancelLoadingDashboardCtx()

	dashboardsChannel := l.loadAllDashboards(loadingDashboardCtx, limit, orgID, dashboardUID)

	for {
		res, ok := <-dashboardsChannel
		if res != nil && res.err != nil {
			l.logger.Error("Error when loading dashboards", "error", err, "orgID", orgID, "dashboardUID", dashboardUID)
			break
		}

		if res == nil || !ok {
			break
		}

		rows := res.dashboards

		_, readDashboardSpan := l.tracer.Start(ctx, "sqlDashboardLoader readDashboard")
		readDashboardSpan.SetAttributes("orgID", orgID, attribute.Key("orgID").Int64(orgID))
		readDashboardSpan.SetAttributes("dashboardCount", len(rows), attribute.Key("dashboardCount").Int(len(rows)))

		reader := kdash.NewStaticDashboardSummaryBuilder(lookup, false)

		for _, row := range rows {
			summary, _, err := reader(ctx, row.Uid, row.Data)
			if err != nil {
				l.logger.Warn("Error indexing dashboard data", "error", err, "dashboardId", row.Id, "dashboardSlug", row.Slug)
				// But append info anyway for now, since we possibly extracted useful information.
			}
			dashboards = append(dashboards, dashboard{
				id:       row.Id,
				uid:      row.Uid,
				isFolder: row.IsFolder,
				folderID: row.FolderID,
				slug:     row.Slug,
				created:  row.Created,
				updated:  row.Updated,
				summary:  summary,
			})
		}
		readDashboardSpan.End()
	}

	return dashboards, err
}

func newFolderIDLookup(sql db.DB) folderUIDLookup {
	return func(ctx context.Context, folderID int64) (string, error) {
		uid := ""
		err := sql.WithDbSession(ctx, func(sess *db.Session) error {
			res, err := sess.Query("SELECT uid FROM dashboard WHERE id=?", folderID)
			if err != nil {
				return err
			}
			if len(res) > 0 {
				uid = string(res[0]["uid"])
			}
			return nil
		})
		return uid, err
	}
}

type dashboardQueryResult struct {
	Id       int64
	Uid      string
	IsFolder bool   `xorm:"is_folder"`
	FolderID int64  `xorm:"folder_id"`
	Slug     string `xorm:"slug"`
	Data     []byte
	Created  time.Time
	Updated  time.Time
}
