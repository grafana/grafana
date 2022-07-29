package searchV2

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/filestorage"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store"

	"github.com/blugelabs/bluge"
)

// buildSignal is sent when search index is accessed in organization for which
// we have not constructed an index yet.
type buildSignal struct {
	orgID int64
	done  chan error
}

type fileStore interface {
	Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error)
	Upload(ctx context.Context, user *models.SignedInUser, req *store.UploadRequest) error
}

type eventStore interface {
	OnEvent(handler store.EventHandler)
	GetLastEvent(ctx context.Context) (*store.EntityEvent, error)
	GetAllEventsAfter(ctx context.Context, id int64) ([]*store.EntityEvent, error)
}

type orgIndexManager struct {
	mu           sync.RWMutex
	config       orgManagerConfig
	indexFactory IndexFactory
	eventStore   eventStore
	fileStore    fileStore
	logger       log.Logger
	syncCh       chan chan struct{}
	buildSignals chan buildSignal
	perOrgIndex  map[int64]Index
}

type orgManagerConfig struct {
	Name                  string
	ReIndexInterval       time.Duration
	EventsPollingInterval time.Duration
	BackupBaseDir         string
}

func newOrgIndexManager(config orgManagerConfig, indexFactory IndexFactory, eventStore eventStore, fileStore fileStore) *orgIndexManager {
	config.BackupBaseDir = "data/gf_search"
	return &orgIndexManager{
		config:       config,
		indexFactory: indexFactory,
		eventStore:   eventStore,
		fileStore:    fileStore,
		perOrgIndex:  map[int64]Index{},
		logger:       log.New("index_manager_" + config.Name),
		buildSignals: make(chan buildSignal),
		syncCh:       make(chan chan struct{}),
	}
}

// sync method allows to catch up with the latest changes in entity_events
// table. This allows us to return consistent search results immediately after
// entity changed even in HA setup without waiting for periodic entity event
// application.
func (m *orgIndexManager) sync(ctx context.Context) error {
	doneCh := make(chan struct{}, 1)
	select {
	case m.syncCh <- doneCh:
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

const (
	defaultReIndexInterval       = 5 * time.Minute
	defaultEventsPollingInterval = 5 * time.Second
)

func (m *orgIndexManager) run(ctx context.Context, orgIDs []int64, reIndexSignalCh chan bool) error {
	reIndexInterval := m.config.ReIndexInterval
	if reIndexInterval == 0 {
		reIndexInterval = defaultReIndexInterval
	}
	fullReIndexTimer := time.NewTimer(reIndexInterval)
	defer fullReIndexTimer.Stop()

	eventsPollingInterval := m.config.EventsPollingInterval
	if eventsPollingInterval == 0 {
		eventsPollingInterval = defaultEventsPollingInterval
	}
	eventsPollingTimer := time.NewTimer(eventsPollingInterval)
	defer eventsPollingTimer.Stop()

	var lastEventID int64
	var loadOK bool
	var err error

	lastEventID, loadOK, err = m.loadFromBackup(ctx, orgIDs)
	if err != nil {
		println(1)
		return err
	}
	if !loadOK {
		lastEvent, err := m.eventStore.GetLastEvent(ctx)
		if err != nil {
			return err
		}
		if lastEvent != nil {
			lastEventID = lastEvent.Id
		}
		err = m.buildInitialIndexes(ctx, orgIDs)
		if err != nil {
			return err
		}
		err = m.saveBackup(ctx, lastEventID, orgIDs)
		if err != nil {
			return err
		}
		err = m.compressBackup(ctx)
		if err != nil {
			return err
		}
		//err = m.decompressBackup(ctx)
		//if err != nil {
		//	return err
		//}
		err = m.uploadBackup(ctx)
		if err != nil {
			return err
		}
		err = m.downloadBackup(ctx)
		if err != nil {
			return err
		}
	}

	// This semaphore channel allows limiting concurrent async re-indexing routines to 1.
	asyncReIndexSemaphore := make(chan struct{}, 1)

	// Channel to handle signals about asynchronous full re-indexing completion.
	reIndexDoneCh := make(chan int64, 1)

	needForcedReindex := false

	for {
		select {
		case doneCh := <-m.syncCh:
			// Executed on search read requests to make sure index is consistent.
			lastEventID = m.applyIndexUpdates(ctx, lastEventID)
			close(doneCh)
		case <-eventsPollingTimer.C:
			// Periodically apply updates collected in entity events table.
			lastEventID = m.applyIndexUpdates(ctx, lastEventID)
			eventsPollingTimer.Reset(eventsPollingInterval)
		case force := <-reIndexSignalCh:
			// External systems may trigger re-indexing, at this moment provisioning does this.
			m.logger.Info("Full re-indexing due to external signal", "name", m.config.Name)
			needForcedReindex = force
			fullReIndexTimer.Reset(0)
		case signal := <-m.buildSignals:
			// When search read request meets new not-indexed org we build index for it.
			m.mu.RLock()
			_, ok := m.perOrgIndex[signal.orgID]
			if ok {
				// Index for org already exists, do nothing.
				m.mu.RUnlock()
				close(signal.done)
				continue
			}
			m.mu.RUnlock()
			lastIndexedEventID := lastEventID
			// Prevent full re-indexing while we are building index for new org.
			// Full re-indexing will be later re-started in `case lastIndexedEventID := <-reIndexDoneCh`
			// branch.
			fullReIndexTimer.Stop()
			go func() {
				// We need semaphore here since asynchronous re-indexing may be in progress already.
				asyncReIndexSemaphore <- struct{}{}
				defer func() { <-asyncReIndexSemaphore }()
				err = m.buildInitialIndex(ctx, signal.orgID)
				// Need to maintain orgIDs actual for backup logic.
				// TODO: check orgID is not in orgIDs.
				orgIDs = append(orgIDs, signal.orgID)
				signal.done <- err
				reIndexDoneCh <- lastIndexedEventID
			}()
		case <-fullReIndexTimer.C:
			// Periodically rebuild indexes since we could miss updates. At this moment we are issuing
			// entity events non-atomically (outside of transaction) and do not cover all possible entity
			// change places, so periodic re-indexing fixes possibly broken state.
			lastIndexedEventID := lastEventID
			go func(needForcedReindex bool) {
				// Do full re-index asynchronously to avoid blocking index synchronization
				// on read for a long time.

				// We need semaphore here since re-indexing due to build signal may be in progress already.
				asyncReIndexSemaphore <- struct{}{}
				defer func() { <-asyncReIndexSemaphore }()

				started := time.Now()
				m.logger.Info("Start re-indexing", "name", m.config.Name)
				err := m.reIndexExisting(ctx, needForcedReindex)
				if err != nil {
					m.logger.Error("Full re-indexing finished with error", "fullReIndexElapsed", time.Since(started), "error", err, "name", m.config.Name)
				} else {
					m.logger.Info("Full re-indexing finished", "fullReIndexElapsed", time.Since(started), "name", m.config.Name)
				}
				reIndexDoneCh <- lastIndexedEventID
			}(needForcedReindex)
			needForcedReindex = false
		case lastIndexedEventID := <-reIndexDoneCh:
			err = m.saveBackup(ctx, lastEventID, orgIDs)
			if err != nil {
				return err
			}
			// Asynchronous re-indexing is finished. Set lastEventID to the value which
			// was actual at the re-indexing start – so that we could re-apply all the
			// events happened during async index build process and make sure it's consistent.
			if lastEventID != lastIndexedEventID {
				m.logger.Info("Re-apply event ID to last indexed", "currentEventID", lastEventID, "lastIndexedEventID", lastIndexedEventID, "name", m.config.Name)
				lastEventID = lastIndexedEventID
				// Apply events immediately.
				eventsPollingTimer.Reset(0)
			}
			fullReIndexTimer.Reset(reIndexInterval)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (m *orgIndexManager) buildInitialIndexes(ctx context.Context, orgIDs []int64) error {
	started := time.Now()
	m.logger.Info("Start building in-memory indexes", "name", m.config.Name)
	for _, orgID := range orgIDs {
		err := m.buildInitialIndex(ctx, orgID)
		if err != nil {
			return fmt.Errorf("can't build initial index %s for org %d: %w", m.config.Name, orgID, err)
		}
	}
	m.logger.Info("Finish building in-memory indexes", "elapsed", time.Since(started), "name", m.config.Name)
	return nil
}

func (m *orgIndexManager) buildInitialIndex(ctx context.Context, orgID int64) error {
	started := time.Now()
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()

	m.logger.Info("Start building initial org index", "orgId", orgID, "name", m.config.Name)
	index, err := m.indexFactory(ctx, orgID, nil)
	if err != nil {
		return fmt.Errorf("error building initial index %s for org %d: %w", m.config.Name, orgID, err)
	}
	m.logger.Info("Finish building initial org index", "elapsed", time.Since(started), "name", m.config.Name, "orgId", orgID)

	m.mu.Lock()
	m.perOrgIndex[orgID] = index
	m.mu.Unlock()
	return nil
}

func (m *orgIndexManager) reIndexExisting(ctx context.Context, force bool) error {
	m.mu.RLock()
	orgIDs := make([]int64, 0, len(m.perOrgIndex))
	for orgID := range m.perOrgIndex {
		orgIDs = append(orgIDs, orgID)
	}
	m.mu.RUnlock()

	for _, orgID := range orgIDs {
		m.mu.Lock()
		i, ok := m.perOrgIndex[orgID]
		if !ok {
			// Skip event for org not yet indexed.
			m.mu.Unlock()
			continue
		}
		m.mu.Unlock()
		err := i.ReIndex(ctx, force)
		if err != nil {
			return fmt.Errorf("error re-indexing %s for org %d: %w", m.config.Name, orgID, err)
		}
	}
	return nil
}

func (m *orgIndexManager) applyIndexUpdates(ctx context.Context, lastEventID int64) int64 {
	events, err := m.eventStore.GetAllEventsAfter(context.Background(), lastEventID)
	if err != nil {
		m.logger.Error("can't load events", "error", err, "name", m.config.Name)
		return lastEventID
	}
	if len(events) == 0 {
		return lastEventID
	}
	started := time.Now()

	resourceEvents, err := store.GetResourceEvents(events)
	if err != nil {
		m.logger.Error("can't apply events, malformed entity ID", "error", err, "name", m.config.Name)
		return lastEventID
	}

	for _, resourceEvent := range resourceEvents {
		m.mu.Lock()
		i, ok := m.perOrgIndex[resourceEvent.OrgID]
		if !ok {
			// Skip event for org not yet indexed.
			m.mu.Unlock()
			continue
		}
		m.mu.Unlock()
		err = i.ApplyEvent(ctx, resourceEvent)
		if err != nil {
			m.logger.Error("can't apply events", "error", err, "name", m.config.Name)
			return lastEventID
		}
		lastEventID = resourceEvent.ID
	}
	m.logger.Info("Index updates applied", "name", m.config.Name, "indexEventsAppliedElapsed", time.Since(started), "numEvents", len(events))
	return lastEventID
}

func (m *orgIndexManager) getOrgIndex(orgID int64) (Index, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	r, ok := m.perOrgIndex[orgID]
	return r, ok
}

func (m *orgIndexManager) getOrCreateOrgIndex(ctx context.Context, orgID int64) (Index, error) {
	index, ok := m.getOrgIndex(orgID)
	if !ok {
		// For non-main organization indexes are built lazily.
		// If we don't have an index then we are blocking here until an index for
		// an organization is ready. This actually takes time only during the first
		// access, all the consequent search requests do not fall into this branch.
		doneIndexing := make(chan error, 1)
		signal := buildSignal{orgID: orgID, done: doneIndexing}
		select {
		case m.buildSignals <- signal:
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
		index, _ = m.getOrgIndex(orgID)
	}
	return index, nil
}

type metaContent struct {
	EventID int64 `json:"eventId"`
}

func (m *orgIndexManager) loadFromBackup(ctx context.Context, orgIDs []int64) (int64, bool, error) {
	backupBaseDir := m.config.BackupBaseDir
	if _, err := os.Stat(backupBaseDir); os.IsNotExist(err) {
		err := os.MkdirAll(backupBaseDir, 0700)
		if err != nil {
			return 0, false, fmt.Errorf("can't create backup dir %s: %w", backupBaseDir, err)
		}
		return 0, false, nil
	}
	metaFile := filepath.Join(backupBaseDir, "meta.json")
	if _, err := os.Stat(metaFile); err != nil {
		if os.IsNotExist(err) {
			return 0, false, nil
		}
		return 0, false, fmt.Errorf("can't stat meta file %s: %w", metaFile, err)
	}

	content, err := os.ReadFile(metaFile)
	if err != nil {
		return 0, false, fmt.Errorf("can't read meta file %s: %w", metaFile, err)
	}

	var meta metaContent
	err = json.Unmarshal(content, &meta)
	if err != nil {
		return 0, false, fmt.Errorf("can't unmarshal meta content: %w", err)
	}

	for _, orgID := range orgIDs {
		orgBackupDir := filepath.Join(backupBaseDir, "org_"+strconv.FormatInt(orgID, 10))
		m.logger.Info("Start loading initial org index from backup", "orgId", orgID, "name", m.config.Name)
		started := time.Now()
		config := bluge.InMemoryFromBackup(orgBackupDir)
		dashboardWriter, err := bluge.OpenWriter(config)
		if err != nil {
			return 0, false, fmt.Errorf("can't open org writer %s: %w", orgBackupDir, err)
		}
		index, err := m.indexFactory(ctx, orgID, dashboardWriter)
		if err != nil {
			return 0, false, fmt.Errorf("error loading initial index %s for org %d from backup: %w", m.config.Name, orgID, err)
		}
		m.logger.Info("Finish loading initial org index from backup", "elapsed", time.Since(started), "name", m.config.Name, "orgId", orgID)

		m.mu.Lock()
		m.perOrgIndex[orgID] = index
		m.mu.Unlock()
	}
	return meta.EventID, true, nil
}

func (m *orgIndexManager) saveBackup(_ context.Context, currentEventID int64, orgIDs []int64) error {
	backupBaseDir := m.config.BackupBaseDir
	if _, err := os.Stat(backupBaseDir); os.IsNotExist(err) {
		return fmt.Errorf("dir does not exists: %s", backupBaseDir)
	}

	tmpDir, err := ioutil.TempDir("", "gf_"+m.config.Name+"_backup_tmp")
	if err != nil {
		return fmt.Errorf("can't create tmp dir for backup: %w", err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	meta := metaContent{
		EventID: currentEventID,
	}
	content, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	metaFile := filepath.Join(tmpDir, "meta.json")
	err = ioutil.WriteFile(metaFile, content, 0700)
	if err != nil {
		return fmt.Errorf("can't write tmp meta file: %w", err)
	}

	for _, orgID := range orgIDs {
		orgBackupDir := filepath.Join(tmpDir, "org_"+strconv.FormatInt(orgID, 10))
		err := os.MkdirAll(orgBackupDir, 0700)
		if err != nil {
			return fmt.Errorf("can't create tmp backup dir %s: %w", orgBackupDir, err)
		}
		m.logger.Info("Start backup of org index", "orgId", orgID, "name", m.config.Name)
		started := time.Now()
		index := m.perOrgIndex[orgID]
		reader, cancel, err := index.Reader()
		if err != nil {
			return err
		}
		cancelCh := make(chan struct{})
		err = reader.Backup(orgBackupDir, cancelCh)
		if err != nil {
			cancel()
			return fmt.Errorf("can't write backup to %s: %w", orgBackupDir, err)
		}
		cancel()
		m.logger.Info("Finish backup of org index", "orgId", orgID, "name", m.config.Name, "elapsed", time.Since(started))
	}

	// TODO: os.Rename returns error if destination dir exists, so we remove existing backup dir first.
	// This means we can't move atomically. Is there a way?
	err = os.RemoveAll(backupBaseDir)
	if err != nil {
		return fmt.Errorf("can't remove backup dir: %w", err)
	}

	err = os.Rename(tmpDir, backupBaseDir)
	if err != nil {
		return fmt.Errorf("can't rename tmp backup dir %s: %w", tmpDir, err)
	}
	return nil
}

func (m *orgIndexManager) compressBackup(_ context.Context) error {
	backupBaseDir := m.config.BackupBaseDir
	var buf bytes.Buffer
	err := compressFolder(backupBaseDir, &buf)
	if err != nil {
		return fmt.Errorf("can't compress backup folder: %w", err)
	}
	tmpFile, err := ioutil.TempFile("", "gf_"+m.config.Name+"_backup_compressed")
	if err != nil {
		return fmt.Errorf("can't create tmp file for compressed backup: %w", err)
	}
	err = ioutil.WriteFile(tmpFile.Name(), buf.Bytes(), 0700)
	if err != nil {
		return fmt.Errorf("can't write into tmp file: %w", err)
	}
	//defer func() { _ = os.RemoveAll(tmpFile.Name()) }()
	return os.Rename(tmpFile.Name(), "data/backup.tar.gz")
}

func (m *orgIndexManager) decompressBackup(_ context.Context) error {
	compressedFilePath := "data/backup.tar.gz"
	uncompressedBackupPath := "data/gf_search_uncompressed"
	content, err := ioutil.ReadFile(compressedFilePath)
	if err != nil {
		return err
	}
	reader := bytes.NewReader(content)
	return decompressToFolder(reader, uncompressedBackupPath)
}

func (m *orgIndexManager) uploadBackup(ctx context.Context) error {
	started := time.Now()
	defer func() {
		m.logger.Info("uploaded backup", "elapsed", time.Since(started))
	}()
	compressedFilePath := "data/backup.tar.gz"
	content, err := ioutil.ReadFile(compressedFilePath)
	if err != nil {
		return fmt.Errorf("error uploading backup: %w", err)
	}
	err = m.fileStore.Upload(ctx, store.SearchServiceAdmin, &store.UploadRequest{
		Contents:              content,
		Path:                  "system/search/backup.tar.gz",
		EntityType:            store.EntityTypeArchive,
		OverwriteExistingFile: true,
	})
	if err != nil {
		return fmt.Errorf("error uploading backup: %w", err)
	}
	return nil
}

func (m *orgIndexManager) downloadBackup(ctx context.Context) error {
	started := time.Now()
	defer func() {
		m.logger.Info("downloaded backup", "elapsed", time.Since(started))
	}()
	f, err := m.fileStore.Read(ctx, store.SearchServiceAdmin, "system/search/backup.tar.gz")
	if err != nil {
		return fmt.Errorf("error reading backup: %w", err)
	}
	fmt.Println(len(f.Contents))
	return nil
}
