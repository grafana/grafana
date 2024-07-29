package cloudmigrationimpl

import (
	"context"
	cryptoRand "crypto/rand"
	"fmt"
	"os"
	"path/filepath"
	"time"

	snapshot "github.com/grafana/grafana-cloud-migration-snapshot/src"
	"github.com/grafana/grafana-cloud-migration-snapshot/src/contracts"
	"github.com/grafana/grafana-cloud-migration-snapshot/src/infra/crypto"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/slicesext"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/retryer"
	"golang.org/x/crypto/nacl/box"
)

func (s *Service) getMigrationDataJSON(ctx context.Context, signedInUser *user.SignedInUser) (*cloudmigration.MigrateDataRequest, error) {
	// Data sources
	dataSources, err := s.getDataSourceCommands(ctx)
	if err != nil {
		s.log.Error("Failed to get datasources", "err", err)
		return nil, err
	}

	// Dashboards and folders are linked via the schema, so we need to get both
	dashboards, folders, err := s.getDashboardAndFolderCommands(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get dashboards and folders", "err", err)
		return nil, err
	}

	migrationDataSlice := make(
		[]cloudmigration.MigrateDataRequestItem, 0,
		len(dataSources)+len(dashboards)+len(folders),
	)

	for _, ds := range dataSources {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.DatasourceDataType,
			RefID: ds.UID,
			Name:  ds.Name,
			Data:  ds,
		})
	}

	for _, dashboard := range dashboards {
		dashboard.Data.Del("id")
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.DashboardDataType,
			RefID: dashboard.UID,
			Name:  dashboard.Title,
			Data:  map[string]any{"dashboard": dashboard.Data},
		})
	}

	for _, f := range folders {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.FolderDataType,
			RefID: f.UID,
			Name:  f.Title,
			Data:  f,
		})
	}

	migrationData := &cloudmigration.MigrateDataRequest{
		Items: migrationDataSlice,
	}

	return migrationData, nil
}

func (s *Service) getDataSourceCommands(ctx context.Context) ([]datasources.AddDataSourceCommand, error) {
	dataSources, err := s.dsService.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		s.log.Error("Failed to get all datasources", "err", err)
		return nil, err
	}

	result := []datasources.AddDataSourceCommand{}
	for _, dataSource := range dataSources {
		// Decrypt secure json to send raw credentials
		decryptedData, err := s.secretsService.DecryptJsonData(ctx, dataSource.SecureJsonData)
		if err != nil {
			s.log.Error("Failed to decrypt secure json data", "err", err)
			return nil, err
		}
		dataSourceCmd := datasources.AddDataSourceCommand{
			OrgID:           dataSource.OrgID,
			Name:            dataSource.Name,
			Type:            dataSource.Type,
			Access:          dataSource.Access,
			URL:             dataSource.URL,
			User:            dataSource.User,
			Database:        dataSource.Database,
			BasicAuth:       dataSource.BasicAuth,
			BasicAuthUser:   dataSource.BasicAuthUser,
			WithCredentials: dataSource.WithCredentials,
			IsDefault:       dataSource.IsDefault,
			JsonData:        dataSource.JsonData,
			SecureJsonData:  decryptedData,
			ReadOnly:        dataSource.ReadOnly,
			UID:             dataSource.UID,
		}
		result = append(result, dataSourceCmd)
	}
	return result, err
}

func (s *Service) getDashboardAndFolderCommands(ctx context.Context, signedInUser *user.SignedInUser) ([]dashboards.Dashboard, []folder.CreateFolderCommand, error) {
	dashs, err := s.dashboardService.GetAllDashboards(ctx)
	if err != nil {
		return nil, nil, err
	}

	dashboardCmds := make([]dashboards.Dashboard, 0)
	folderUids := make([]string, 0)
	softDeleteEnabled := s.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore)

	// Folders need to be fetched by UID in a separate step, separate dashboards from folders
	// If any result is in the trash bin, don't migrate it
	for _, d := range dashs {
		if softDeleteEnabled && !d.Deleted.IsZero() {
			continue
		}

		if d.IsFolder {
			folderUids = append(folderUids, d.UID)
		} else {
			dashboardCmds = append(dashboardCmds, *d)
		}
	}

	folders, err := s.folderService.GetFolders(ctx, folder.GetFoldersQuery{
		UIDs:             folderUids,
		SignedInUser:     signedInUser,
		WithFullpathUIDs: true,
	})
	if err != nil {
		return nil, nil, err
	}

	folderCmds := make([]folder.CreateFolderCommand, len(folders))
	for i, f := range folders {
		folderCmds[i] = folder.CreateFolderCommand{
			UID:         f.UID,
			Title:       f.Title,
			Description: f.Description,
			ParentUID:   f.ParentUID,
		}
	}

	return dashboardCmds, folderCmds, nil
}

// asynchronous process for writing the snapshot to the filesystem and updating the snapshot status
func (s *Service) buildSnapshot(ctx context.Context, signedInUser *user.SignedInUser, maxItemsPerPartition uint32, metadata []byte, snapshotMeta cloudmigration.CloudMigrationSnapshot) error {
	// TODO -- make sure we can only build one snapshot at a time
	s.buildSnapshotMutex.Lock()
	defer s.buildSnapshotMutex.Unlock()

	start := time.Now()
	defer func() {
		s.log.Debug(fmt.Sprintf("buildSnapshot: method completed in %d ms", time.Since(start).Milliseconds()))
	}()

	// Update status to snapshot creating with retries
	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:    snapshotMeta.UID,
		Status: cloudmigration.SnapshotStatusCreating,
	}); err != nil {
		return err
	}

	publicKey, privateKey, err := box.GenerateKey(cryptoRand.Reader)
	if err != nil {
		return fmt.Errorf("nacl: generating public and private key: %w", err)
	}

	s.log.Debug(fmt.Sprintf("buildSnapshot: generated keys in %d ms", time.Since(start).Milliseconds()))

	// Use GMS public key + the grafana generated private private key to encrypt snapshot files.
	snapshotWriter, err := snapshot.NewSnapshotWriter(contracts.AssymetricKeys{
		Public:  snapshotMeta.EncryptionKey,
		Private: privateKey[:],
	},
		crypto.NewNacl(),
		snapshotMeta.LocalDir,
	)
	if err != nil {
		return fmt.Errorf("instantiating snapshot writer: %w", err)
	}

	s.log.Debug(fmt.Sprintf("buildSnapshot: created snapshot writing in %d ms", time.Since(start).Milliseconds()))

	migrationData, err := s.getMigrationDataJSON(ctx, signedInUser)
	if err != nil {
		return fmt.Errorf("fetching migration data: %w", err)
	}

	s.log.Debug(fmt.Sprintf("buildSnapshot: got migration data json in %d ms", time.Since(start).Milliseconds()))

	localSnapshotResource := make([]cloudmigration.CloudMigrationResource, len(migrationData.Items))
	resourcesGroupedByType := make(map[cloudmigration.MigrateDataType][]snapshot.MigrateDataRequestItemDTO, 0)
	for i, item := range migrationData.Items {
		resourcesGroupedByType[item.Type] = append(resourcesGroupedByType[item.Type], snapshot.MigrateDataRequestItemDTO{
			Type:  snapshot.MigrateDataType(item.Type),
			RefID: item.RefID,
			Name:  item.Name,
			Data:  item.Data,
		})

		localSnapshotResource[i] = cloudmigration.CloudMigrationResource{
			Type:   item.Type,
			RefID:  item.RefID,
			Status: cloudmigration.ItemStatusPending,
		}
	}

	for _, resourceType := range []cloudmigration.MigrateDataType{
		cloudmigration.DatasourceDataType,
		cloudmigration.FolderDataType,
		cloudmigration.DashboardDataType,
	} {
		for _, chunk := range slicesext.Chunks(int(maxItemsPerPartition), resourcesGroupedByType[resourceType]) {
			if err := snapshotWriter.Write(string(resourceType), chunk); err != nil {
				return fmt.Errorf("writing resources to snapshot writer: resourceType=%s %w", resourceType, err)
			}
		}
	}

	s.log.Debug(fmt.Sprintf("buildSnapshot: wrote data files in %d ms", time.Since(start).Milliseconds()))

	// Add the grafana generated public key to the index file so gms can use it to decrypt the snapshot files later.
	// This works because the snapshot files are being encrypted with
	// the grafana generated private key + the gms public key.
	if _, err := snapshotWriter.Finish(snapshot.FinishInput{
		SenderPublicKey: publicKey[:],
		Metadata:        metadata,
	}); err != nil {
		return fmt.Errorf("finishing writing snapshot files and generating index file: %w", err)
	}

	s.log.Debug(fmt.Sprintf("buildSnapshot: finished snapshot in %d ms", time.Since(start).Milliseconds()))

	// update snapshot status to pending upload with retries
	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:       snapshotMeta.UID,
		Status:    cloudmigration.SnapshotStatusPendingUpload,
		Resources: localSnapshotResource,
	}); err != nil {
		return err
	}

	return nil
}

// asynchronous process for and updating the snapshot status
func (s *Service) uploadSnapshot(ctx context.Context, session *cloudmigration.CloudMigrationSession, snapshotMeta *cloudmigration.CloudMigrationSnapshot, uploadUrl string) (err error) {
	// TODO -- make sure we can only upload one snapshot at a time
	s.buildSnapshotMutex.Lock()
	defer s.buildSnapshotMutex.Unlock()

	start := time.Now()
	defer func() {
		s.log.Debug(fmt.Sprintf("uploadSnapshot: method completed in %d ms", time.Since(start).Milliseconds()))
	}()

	// update snapshot status to uploading with retries
	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:    snapshotMeta.UID,
		Status: cloudmigration.SnapshotStatusUploading,
	}); err != nil {
		return err
	}

	indexFilePath := filepath.Join(snapshotMeta.LocalDir, "index.json")
	// LocalDir can be set in the configuration, therefore the file path can be set to any path.
	// nolint:gosec
	indexFile, err := os.Open(indexFilePath)
	if err != nil {
		return fmt.Errorf("opening index files: %w", err)
	}
	defer func() {
		if closeErr := indexFile.Close(); closeErr != nil {
			s.log.Error("closing index file", "err", closeErr.Error())
		}
	}()

	index, err := snapshot.ReadIndex(indexFile)
	if err != nil {
		return fmt.Errorf("reading index from file: %w", err)
	}

	s.log.Debug(fmt.Sprintf("uploadSnapshot: read index file in %d ms", time.Since(start).Milliseconds()))

	// Upload the data files.
	for _, fileNames := range index.Items {
		for _, fileName := range fileNames {
			filePath := filepath.Join(snapshotMeta.LocalDir, fileName)
			key := fmt.Sprintf("%d/snapshots/%s/%s", session.StackID, snapshotMeta.GMSSnapshotUID, fileName)
			if err := s.uploadUsingPresignedURL(ctx, uploadUrl, key, filePath); err != nil {
				return fmt.Errorf("uploading snapshot file using presigned url: %w", err)
			}
			s.log.Debug(fmt.Sprintf("uploadSnapshot: uploaded %s in %d ms", fileName, time.Since(start).Milliseconds()))
		}
	}

	s.log.Debug(fmt.Sprintf("uploadSnapshot: uploaded all data files in %d ms", time.Since(start).Milliseconds()))

	// Upload the index file. Must be done after uploading the data files.
	key := fmt.Sprintf("%d/snapshots/%s/%s", session.StackID, snapshotMeta.GMSSnapshotUID, "index.json")
	if _, err := indexFile.Seek(0, 0); err != nil {
		return fmt.Errorf("seeking to beginning of index file: %w", err)
	}

	if err := s.objectStorage.PresignedURLUpload(ctx, uploadUrl, key, indexFile); err != nil {
		return fmt.Errorf("uploading file using presigned url: %w", err)
	}

	s.log.Debug(fmt.Sprintf("uploadSnapshot: uploaded index file in %d ms", time.Since(start).Milliseconds()))
	s.log.Info("successfully uploaded snapshot", "snapshotUid", snapshotMeta.UID, "cloud_snapshotUid", snapshotMeta.GMSSnapshotUID)

	// update snapshot status to processing with retries
	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:    snapshotMeta.UID,
		Status: cloudmigration.SnapshotStatusProcessing,
	}); err != nil {
		return err
	}

	return nil
}

func (s *Service) uploadUsingPresignedURL(ctx context.Context, uploadURL, key string, filePath string) (err error) {
	// The directory that contains the file can set in the configuration, therefore the directory can be any directory.
	// nolint:gosec
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("opening snapshot file: path=%s %w", filePath, err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			s.log.Error("closing file", "path", filePath, "err", closeErr)
		}
	}()

	if err = s.objectStorage.PresignedURLUpload(ctx, uploadURL, key, file); err != nil {
		return fmt.Errorf("uploading file using presigned url: %w", err)
	}

	return nil
}

func (s *Service) updateSnapshotWithRetries(ctx context.Context, cmd cloudmigration.UpdateSnapshotCmd) (err error) {
	if err := retryer.Retry(func() (retryer.RetrySignal, error) {
		err := s.store.UpdateSnapshot(ctx, cmd)
		return retryer.FuncComplete, err
	}, 10, time.Millisecond*100, time.Second*10); err != nil {
		s.log.Error("failed to update snapshot status", "snapshotUid", cmd.UID, "status", cmd.Status, "num_resources", len(cmd.Resources), "error", err.Error())
		return fmt.Errorf("failed to update snapshot status: %w", err)
	}
	return nil
}
