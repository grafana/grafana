package cloudmigrationimpl

import (
	"context"
	cryptoRand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"time"

	"go.opentelemetry.io/otel/codes"
	"golang.org/x/crypto/nacl/box"

	snapshot "github.com/grafana/grafana-cloud-migration-snapshot/src"
	"github.com/grafana/grafana-cloud-migration-snapshot/src/contracts"
	"github.com/grafana/grafana-cloud-migration-snapshot/src/infra/crypto"
	"github.com/grafana/grafana/pkg/infra/tracing"
	plugins "github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	libraryelements "github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/retryer"
)

var currentMigrationTypes = []cloudmigration.MigrateDataType{
	cloudmigration.DatasourceDataType,
	cloudmigration.FolderDataType,
	cloudmigration.LibraryElementDataType,
	cloudmigration.DashboardDataType,
	cloudmigration.MuteTimingType,
	cloudmigration.NotificationTemplateType,
	cloudmigration.ContactPointType,
	cloudmigration.NotificationPolicyType,
	cloudmigration.AlertRuleGroupType,
	cloudmigration.AlertRuleType,
	cloudmigration.PluginDataType,
}

func (s *Service) getMigrationDataJSON(ctx context.Context, signedInUser *user.SignedInUser) (*cloudmigration.MigrateDataRequest, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.getMigrationDataJSON")
	defer span.End()

	migrationDataSlice := make([]cloudmigration.MigrateDataRequestItem, 0)

	folderHierarchy := make(map[cloudmigration.MigrateDataType]map[string]string, 0)

	// Plugins
	plugins, err := s.getPlugins(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get plugins", "err", err)
		return nil, err
	}

	for _, plugin := range plugins {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.PluginDataType,
			RefID: plugin.ID,
			Name:  plugin.Name,
			Data:  plugin.SettingCmd,
		})
	}

	// Data sources
	dataSources, err := s.getDataSourceCommands(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get datasources", "err", err)
		return nil, err
	}

	for _, ds := range dataSources {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.DatasourceDataType,
			RefID: ds.UID,
			Name:  ds.Name,
			Data:  ds,
		})
	}

	// Dashboards & Folders: linked via the schema, so we need to get both
	dashs, folders, err := s.getDashboardAndFolderCommands(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get dashboards and folders", "err", err)
		return nil, err
	}

	folderHierarchy[cloudmigration.DashboardDataType] = make(map[string]string, 0)

	for _, dashboard := range dashs {
		dashboard.Data.Del("id")
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.DashboardDataType,
			RefID: dashboard.UID,
			Name:  dashboard.Title,
			Data: dashboards.SaveDashboardCommand{
				Dashboard: dashboard.Data,
				Overwrite: true, // currently only intended to be a push, not a sync; revisit during the preview
				Message:   fmt.Sprintf("Created via the Grafana Cloud Migration Assistant by on-prem user \"%s\"", signedInUser.Login),
				IsFolder:  false,
				FolderUID: dashboard.FolderUID,
			},
		})

		folderHierarchy[cloudmigration.DashboardDataType][dashboard.UID] = dashboard.FolderUID
	}

	folderHierarchy[cloudmigration.FolderDataType] = make(map[string]string, 0)

	folders = sortFolders(folders)
	for _, f := range folders {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.FolderDataType,
			RefID: f.UID,
			Name:  f.Title,
			Data:  f,
		})

		folderHierarchy[cloudmigration.FolderDataType][f.UID] = f.ParentUID
	}

	// Library Elements
	libraryElements, err := s.getLibraryElementsCommands(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get library elements", "err", err)
		return nil, err
	}

	folderHierarchy[cloudmigration.LibraryElementDataType] = make(map[string]string, 0)

	for _, libraryElement := range libraryElements {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.LibraryElementDataType,
			RefID: libraryElement.UID,
			Name:  libraryElement.Name,
			Data:  libraryElement,
		})

		if libraryElement.FolderUID != nil {
			folderHierarchy[cloudmigration.LibraryElementDataType][libraryElement.UID] = *libraryElement.FolderUID
		}
	}

	// Alerts: Mute Timings
	muteTimings, err := s.getAlertMuteTimings(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get alert mute timings", "err", err)
		return nil, err
	}

	for _, muteTiming := range muteTimings {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.MuteTimingType,
			RefID: muteTiming.UID,
			Name:  muteTiming.Name,
			Data:  muteTiming,
		})
	}

	// Alerts: Notification Templates
	notificationTemplates, err := s.getNotificationTemplates(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get alert notification templates", "err", err)
		return nil, err
	}

	for _, notificationTemplate := range notificationTemplates {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.NotificationTemplateType,
			RefID: notificationTemplate.UID,
			Name:  notificationTemplate.Name,
			Data:  notificationTemplate,
		})
	}

	// Alerts: Contact Points
	contactPoints, err := s.getContactPoints(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get alert contact points", "err", err)
		return nil, err
	}

	for _, contactPoint := range contactPoints {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.ContactPointType,
			RefID: contactPoint.UID,
			Name:  contactPoint.Name,
			Data:  contactPoint,
		})
	}

	// Alerts: Notification Policies
	notificationPolicies, err := s.getNotificationPolicies(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get alert notification policies", "err", err)
		return nil, err
	}

	if len(notificationPolicies.Name) > 0 {
		// Notification Policy can only be managed by updating its entire tree, so we send the whole thing as one item.
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.NotificationPolicyType,
			RefID: notificationPolicies.Name, // no UID available
			Name:  notificationPolicies.Name,
			Data:  notificationPolicies.Routes,
		})
	}

	// Alerts: Alert Rule Groups
	alertRuleGroups, err := s.getAlertRuleGroups(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get alert rule groups", "err", err)
		return nil, err
	}

	for _, alertRuleGroup := range alertRuleGroups {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.AlertRuleGroupType,
			RefID: alertRuleGroup.Title, // no UID available
			Name:  alertRuleGroup.Title,
			Data:  alertRuleGroup,
		})
	}

	// Alerts: Alert Rules
	alertRules, err := s.getAlertRules(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get alert rules", "err", err)
		return nil, err
	}

	folderHierarchy[cloudmigration.AlertRuleType] = make(map[string]string, 0)

	for _, alertRule := range alertRules {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.AlertRuleType,
			RefID: alertRule.UID,
			Name:  alertRule.Title,
			Data:  alertRule,
		})

		folderHierarchy[cloudmigration.AlertRuleType][alertRule.UID] = alertRule.FolderUID
	}

	// Obtain the names of parent elements for data types that have folders.
	parentNamesByType, err := s.getParentNames(ctx, signedInUser, folderHierarchy)
	if err != nil {
		s.log.Error("Failed to get parent folder names", "err", err)
	}

	migrationData := &cloudmigration.MigrateDataRequest{
		Items:           migrationDataSlice,
		ItemParentNames: parentNamesByType,
	}

	return migrationData, nil
}

func (s *Service) getDataSourceCommands(ctx context.Context, signedInUser *user.SignedInUser) ([]datasources.AddDataSourceCommand, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.getDataSourceCommands")
	defer span.End()

	dataSources, err := s.dsService.GetDataSources(ctx, &datasources.GetDataSourcesQuery{OrgID: signedInUser.GetOrgID()})
	if err != nil {
		s.log.Error("Failed to get all datasources", "err", err)
		return nil, err
	}

	result := make([]datasources.AddDataSourceCommand, 0, len(dataSources))
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

// getDashboardAndFolderCommands returns the json payloads required by the dashboard and folder creation APIs
func (s *Service) getDashboardAndFolderCommands(ctx context.Context, signedInUser *user.SignedInUser) ([]dashboards.Dashboard, []folder.CreateFolderCommand, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.getDashboardAndFolderCommands")
	defer span.End()

	dashs, err := s.dashboardService.GetAllDashboardsByOrgId(ctx, signedInUser.GetOrgID())
	if err != nil {
		return nil, nil, err
	}

	dashboardCmds := make([]dashboards.Dashboard, 0)
	folderUids := make([]string, 0)

	// Folders need to be fetched by UID in a separate step, separate dashboards from folders
	// If any result is in the trash bin, don't migrate it
	for _, d := range dashs {
		if d.IsFolder {
			folderUids = append(folderUids, d.UID)
		} else {
			dashboardCmds = append(dashboardCmds, *d)
		}
	}

	folders, err := s.folderService.GetFolders(ctx, folder.GetFoldersQuery{
		UIDs:             folderUids,
		SignedInUser:     signedInUser,
		OrgID:            signedInUser.GetOrgID(),
		WithFullpathUIDs: true,
	})
	if err != nil {
		return nil, nil, err
	}

	folderCmds := make([]folder.CreateFolderCommand, 0, len(folders))
	for _, f := range folders {
		folderCmds = append(folderCmds, folder.CreateFolderCommand{
			UID:         f.UID,
			Title:       f.Title,
			Description: f.Description,
			ParentUID:   f.ParentUID,
		})
	}

	return dashboardCmds, folderCmds, nil
}

type libraryElement struct {
	FolderUID *string         `json:"folderUid"`
	Name      string          `json:"name"`
	UID       string          `json:"uid"`
	Model     json.RawMessage `json:"model"`
	Kind      int64           `json:"kind"`
}

// getLibraryElementsCommands returns the json payloads required by the library elements creation API
func (s *Service) getLibraryElementsCommands(ctx context.Context, signedInUser *user.SignedInUser) ([]libraryElement, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.getLibraryElementsCommands")
	defer span.End()

	const perPage = 100

	cmds := make([]libraryElement, 0)

	page := 1
	count := 0

	for {
		query := libraryelements.SearchLibraryElementsQuery{
			PerPage: perPage,
			Page:    page,
		}

		libraryElements, err := s.libraryElementsService.GetAllElements(ctx, signedInUser, query)
		if err != nil {
			return nil, fmt.Errorf("failed to get all library elements: %w", err)
		}

		for _, element := range libraryElements.Elements {
			var folderUID *string
			if len(element.FolderUID) > 0 {
				folderUID = &element.FolderUID
			}

			cmds = append(cmds, libraryElement{
				FolderUID: folderUID,
				Name:      element.Name,
				Model:     element.Model,
				Kind:      element.Kind,
				UID:       element.UID,
			})
		}

		page += 1
		count += libraryElements.PerPage

		if len(libraryElements.Elements) == 0 || count >= int(libraryElements.TotalCount) {
			break
		}
	}

	return cmds, nil
}

type PluginCmd struct {
	ID         string                                `json:"id"`
	Name       string                                `json:"name"`
	SettingCmd pluginsettings.UpdatePluginSettingCmd `json:"settingCmd"`
}

// IsPublicSignatureType returns true if plugin signature type is public
func IsPublicSignatureType(signatureType plugins.SignatureType) bool {
	switch signatureType {
	case plugins.SignatureTypeGrafana, plugins.SignatureTypeCommercial, plugins.SignatureTypeCommunity:
		return true
	case plugins.SignatureTypePrivate, plugins.SignatureTypePrivateGlob:
		return false
	}
	return false
}

// getPlugins returns the json payloads required by the plugin creation API
func (s *Service) getPlugins(ctx context.Context, signedInUser *user.SignedInUser) ([]PluginCmd, error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.getPlugins")
	defer span.End()

	results := make([]PluginCmd, 0)
	plugins := s.pluginStore.Plugins(ctx)

	// Obtain plugins from gcom
	requestID := tracing.TraceIDFromContext(ctx, false)
	gcomPlugins, err := s.gcomService.GetPlugins(ctx, requestID)
	if err != nil {
		return results, fmt.Errorf("fetching gcom plugins: %w", err)
	}

	// Permissions for listing plugins, taken from plugins api
	userIsOrgAdmin := signedInUser.HasRole(org.RoleAdmin)
	hasAccess, _ := s.accessControl.Evaluate(ctx, signedInUser, ac.EvalAny(
		ac.EvalPermission(datasources.ActionCreate),
		ac.EvalPermission(pluginaccesscontrol.ActionInstall),
	))
	if !(userIsOrgAdmin || hasAccess) {
		s.log.Info("user is not allowed to list non-core plugins", "UID", signedInUser.UserUID)
		return results, nil
	}

	for _, plugin := range plugins {
		// filter plugins to keep only the ones allowed by gcom
		if _, exists := gcomPlugins[plugin.ID]; !exists {
			continue
		}

		// filter plugins to keep only non core, signed, with public signature type plugins
		if plugin.IsCorePlugin() || !plugin.Signature.IsValid() || !IsPublicSignatureType(plugin.SignatureType) {
			continue
		}
		// filter out dependent app plugins
		if plugin.IncludedInAppID != "" {
			continue
		}

		// Permissions filtering, taken from plugins api
		hasAccess, _ = s.accessControl.Evaluate(ctx, signedInUser, ac.EvalPermission(pluginaccesscontrol.ActionWrite, pluginaccesscontrol.ScopeProvider.GetResourceScope(plugin.ID)))
		if !hasAccess {
			continue
		}

		pluginSettingCmd := pluginsettings.UpdatePluginSettingCmd{
			Enabled:       plugin.JSONData.AutoEnabled,
			Pinned:        plugin.Pinned,
			PluginVersion: plugin.Info.Version,
			PluginId:      plugin.ID,
		}

		// get plugin settings from db if they exist
		ps, err := s.pluginSettingsService.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
			PluginID: plugin.ID,
			OrgID:    signedInUser.OrgID,
		})
		if err != nil && !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return nil, fmt.Errorf("failed to get plugin settings: %w", err)
		} else if ps != nil {
			pluginSettingCmd.Enabled = ps.Enabled
			pluginSettingCmd.Pinned = ps.Pinned
			pluginSettingCmd.JsonData = ps.JSONData
			decryptedData, err := s.secretsService.DecryptJsonData(ctx, ps.SecureJSONData)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt secure json data: %w", err)
			}
			pluginSettingCmd.SecureJsonData = decryptedData
		}

		results = append(results, PluginCmd{
			ID:         plugin.ID,
			Name:       plugin.Name,
			SettingCmd: pluginSettingCmd,
		})
	}

	return results, nil
}

// asynchronous process for writing the snapshot to the filesystem and updating the snapshot status
func (s *Service) buildSnapshot(ctx context.Context, signedInUser *user.SignedInUser, maxItemsPerPartition uint32, metadata []byte, snapshotMeta cloudmigration.CloudMigrationSnapshot) error {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.buildSnapshot")
	defer span.End()

	// TODO -- make sure we can only build one snapshot at a time
	s.buildSnapshotMutex.Lock()
	defer s.buildSnapshotMutex.Unlock()

	start := time.Now()
	defer func() {
		s.log.Debug(fmt.Sprintf("buildSnapshot: method completed in %d ms", time.Since(start).Milliseconds()))
	}()

	publicKey, privateKey, err := box.GenerateKey(cryptoRand.Reader)
	if err != nil {
		return fmt.Errorf("nacl: generating public and private key: %w", err)
	}

	s.log.Debug(fmt.Sprintf("buildSnapshot: generated keys in %d ms", time.Since(start).Milliseconds()))

	// Use GMS public key + the grafana generated private key to encrypt snapshot files.
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
			Name:  item.Name,
			Type:  snapshot.MigrateDataType(item.Type),
			RefID: item.RefID,
			Data:  item.Data,
		})

		parentName := ""
		if _, exists := migrationData.ItemParentNames[item.Type]; exists {
			parentName = migrationData.ItemParentNames[item.Type][item.RefID]
		}

		localSnapshotResource[i] = cloudmigration.CloudMigrationResource{
			Name:       item.Name,
			Type:       item.Type,
			RefID:      item.RefID,
			Status:     cloudmigration.ItemStatusPending,
			ParentName: parentName,
		}
	}

	for _, resourceType := range currentMigrationTypes {
		for chunk := range slices.Chunk(resourcesGroupedByType[resourceType], int(maxItemsPerPartition)) {
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
		UID:                    snapshotMeta.UID,
		SessionID:              snapshotMeta.SessionUID,
		Status:                 cloudmigration.SnapshotStatusPendingUpload,
		LocalResourcesToCreate: localSnapshotResource,
	}); err != nil {
		return err
	}

	return nil
}

// asynchronous process for and updating the snapshot status
func (s *Service) uploadSnapshot(ctx context.Context, session *cloudmigration.CloudMigrationSession, snapshotMeta *cloudmigration.CloudMigrationSnapshot, uploadUrl string) (err error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.uploadSnapshot")
	defer span.End()

	// TODO -- make sure we can only upload one snapshot at a time
	s.buildSnapshotMutex.Lock()
	defer s.buildSnapshotMutex.Unlock()

	start := time.Now()
	defer func() {
		s.log.Debug(fmt.Sprintf("uploadSnapshot: method completed in %d ms", time.Since(start).Milliseconds()))
	}()

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

	_, readIndexSpan := s.tracer.Start(ctx, "CloudMigrationService.uploadSnapshot.readIndex")
	index, err := snapshot.ReadIndex(indexFile)
	if err != nil {
		readIndexSpan.SetStatus(codes.Error, "reading index from file")
		readIndexSpan.RecordError(err)
		readIndexSpan.End()

		return fmt.Errorf("reading index from file: %w", err)
	}
	readIndexSpan.End()

	s.log.Debug(fmt.Sprintf("uploadSnapshot: read index file in %d ms", time.Since(start).Milliseconds()))

	uploadCtx, uploadSpan := s.tracer.Start(ctx, "CloudMigrationService.uploadSnapshot.uploadDataFiles")
	// Upload the data files.
	for _, fileNames := range index.Items {
		for _, fileName := range fileNames {
			filePath := filepath.Join(snapshotMeta.LocalDir, fileName)
			key := fmt.Sprintf("%d/snapshots/%s/%s", session.StackID, snapshotMeta.GMSSnapshotUID, fileName)
			if err := s.uploadUsingPresignedURL(uploadCtx, uploadUrl, key, filePath); err != nil {
				uploadSpan.SetStatus(codes.Error, "uploading snapshot data file using presigned url")
				uploadSpan.RecordError(err)
				uploadSpan.End()

				return fmt.Errorf("uploading snapshot file using presigned url: %w", err)
			}
			s.log.Debug(fmt.Sprintf("uploadSnapshot: uploaded %s in %d ms", fileName, time.Since(start).Milliseconds()))
		}
	}
	uploadSpan.End()

	s.log.Debug(fmt.Sprintf("uploadSnapshot: uploaded all data files in %d ms", time.Since(start).Milliseconds()))

	uploadCtx, uploadSpan = s.tracer.Start(ctx, "CloudMigrationService.uploadSnapshot.uploadIndex")

	// Upload the index file. Must be done after uploading the data files.
	key := fmt.Sprintf("%d/snapshots/%s/%s", session.StackID, snapshotMeta.GMSSnapshotUID, "index.json")
	if _, err := indexFile.Seek(0, 0); err != nil {
		uploadSpan.SetStatus(codes.Error, "seeking to beginning of index file")
		uploadSpan.RecordError(err)
		uploadSpan.End()

		return fmt.Errorf("seeking to beginning of index file: %w", err)
	}

	if err := s.objectStorage.PresignedURLUpload(uploadCtx, uploadUrl, key, indexFile); err != nil {
		uploadSpan.SetStatus(codes.Error, "uploading index file using presigned url")
		uploadSpan.RecordError(err)
		uploadSpan.End()

		return fmt.Errorf("uploading file using presigned url: %w", err)
	}

	uploadSpan.End()

	s.log.Debug(fmt.Sprintf("uploadSnapshot: uploaded index file in %d ms", time.Since(start).Milliseconds()))
	s.log.Info("successfully uploaded snapshot", "snapshotUid", snapshotMeta.UID, "cloud_snapshotUid", snapshotMeta.GMSSnapshotUID)

	// update snapshot status to processing with retries
	if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
		UID:       snapshotMeta.UID,
		SessionID: snapshotMeta.SessionUID,
		Status:    cloudmigration.SnapshotStatusProcessing,
	}); err != nil {
		return err
	}

	return nil
}

func (s *Service) uploadUsingPresignedURL(ctx context.Context, uploadURL, key string, filePath string) (err error) {
	ctx, span := s.tracer.Start(ctx, "CloudMigrationService.uploadUsingPresignedURL")
	defer span.End()

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
	maxRetries := 10
	retries := 0
	if err := retryer.Retry(func() (retryer.RetrySignal, error) {
		if err := s.store.UpdateSnapshot(ctx, cmd); err != nil {
			s.log.Error("updating snapshot in retry loop", "error", err.Error())
			retries++
			if retries > maxRetries {
				return retryer.FuncError, err
			}
			return retryer.FuncFailure, nil
		}
		return retryer.FuncComplete, nil
	}, maxRetries, time.Millisecond*10, time.Second*5); err != nil {
		s.log.Error("failed to update snapshot status", "snapshotUid", cmd.UID, "status", cmd.Status, "num_local_resources", len(cmd.LocalResourcesToCreate), "num_cloud_resources", len(cmd.CloudResourcesToUpdate), "error", err.Error())
		return fmt.Errorf("failed to update snapshot status: %w", err)
	}
	return nil
}

// sortFolders implements a sort such that parent folders always come before their children
// Implementation inspired by ChatGPT, OpenAI's language model.
func sortFolders(input []folder.CreateFolderCommand) []folder.CreateFolderCommand {
	// Map from UID to the corresponding folder for quick lookup
	folderMap := make(map[string]folder.CreateFolderCommand)
	for _, folder := range input {
		folderMap[folder.UID] = folder
	}
	// Dynamic map of folderUID to depth
	depthMap := make(map[string]int)

	// Function to get the depth of a folder based on its parent hierarchy
	var getDepth func(uid string) int
	getDepth = func(uid string) int {
		if uid == "" {
			return 0
		}
		if d, ok := depthMap[uid]; ok {
			return d
		}
		folder, exists := folderMap[uid]
		if !exists || folder.ParentUID == "" {
			return 1
		}
		return 1 + getDepth(folder.ParentUID)
	}

	// Calculate the depth of each folder
	for _, folder := range input {
		depthMap[folder.UID] = getDepth(folder.UID)
	}

	// Sort folders by their depth, ensuring a stable sort
	sort.SliceStable(input, func(i, j int) bool {
		return depthMap[input[i].UID] < depthMap[input[j].UID]
	})

	return input
}

// getFolderNamesForFolderUIDs queries the folders service to obtain folder names for a list of folderUIDs
func (s *Service) getFolderNamesForFolderUIDs(ctx context.Context, signedInUser *user.SignedInUser, folderUIDs []string) (map[string](string), error) {
	folders, err := s.folderService.GetFolders(ctx, folder.GetFoldersQuery{
		UIDs:             folderUIDs,
		SignedInUser:     signedInUser,
		OrgID:            signedInUser.GetOrgID(),
		WithFullpathUIDs: true,
	})
	if err != nil {
		s.log.Error("Failed to obtain folders from folder UIDs", "err", err)
		return nil, err
	}

	folderUIDsToNames := make(map[string](string), len(folderUIDs))
	for _, folderUID := range folderUIDs {
		folderUIDsToNames[folderUID] = ""
	}
	for _, f := range folders {
		folderUIDsToNames[f.UID] = f.Title
	}
	return folderUIDsToNames, nil
}

// getParentNames finds the parent names for resources and returns a map of data type: {data UID : parentName}
// for dashboards, folders and library elements - the parent is the parent folder
func (s *Service) getParentNames(
	ctx context.Context,
	signedInUser *user.SignedInUser,
	folderHierarchy map[cloudmigration.MigrateDataType]map[string]string,
) (map[cloudmigration.MigrateDataType]map[string](string), error) {
	parentNamesByType := make(map[cloudmigration.MigrateDataType]map[string]string)
	for _, dataType := range currentMigrationTypes {
		parentNamesByType[dataType] = make(map[string]string)
	}

	// Obtain list of unique folderUIDs
	parentFolderUIDsSet := make(map[string]struct{})

	for _, folderUIDs := range folderHierarchy {
		for _, folderUID := range folderUIDs {
			// Skip the root folder
			if folderUID == "" {
				continue
			}

			parentFolderUIDsSet[folderUID] = struct{}{}
		}
	}

	parentFolderUIDsSlice := make([]string, 0, len(parentFolderUIDsSet))
	for parentFolderUID := range parentFolderUIDsSet {
		parentFolderUIDsSlice = append(parentFolderUIDsSlice, parentFolderUID)
	}

	// Obtain folder names given a list of folderUIDs
	foldersUIDsToFolderName, err := s.getFolderNamesForFolderUIDs(ctx, signedInUser, parentFolderUIDsSlice)
	if err != nil {
		s.log.Error("Failed to get parent folder names from folder UIDs", "err", err)
		return parentNamesByType, err
	}

	// Prepare map of {data type: {data UID : parentName}}
	for dataType, uidFolderMap := range folderHierarchy {
		for uid, folderUID := range uidFolderMap {
			parentNamesByType[dataType][uid] = foldersUIDsToFolderName[folderUID]
		}
	}

	return parentNamesByType, err
}
