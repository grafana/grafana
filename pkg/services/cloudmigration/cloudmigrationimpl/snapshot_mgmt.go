package cloudmigrationimpl

import (
	"context"
	cryptoRand "crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"sort"
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
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/retryer"
	"github.com/prometheus/alertmanager/timeinterval"
	"golang.org/x/crypto/nacl/box"
)

type alertRule struct {
	ID                   int64                  `json:"id"`
	OrgID                int64                  `json:"orgID"`
	Title                string                 `json:"title"`
	Condition            string                 `json:"condititon"`
	Data                 []alertQuery           `json:"data"`
	Updated              time.Time              `json:"updated"`
	IntervalSeconds      int64                  `json:"intervalSeconds"`
	UID                  string                 `json:"uid"`
	NamespaceUID         string                 `json:"namespaceUID"`
	DashboardUID         *string                `json:"dashboardUID"`
	PanelID              *int64                 `json:"panelID"`
	RuleGroup            string                 `json:"ruleGroup"`
	RuleGroupIndex       int                    `json:"ruleGroupIndex"`
	Record               *record                `json:"record"`
	NoDataState          string                 `json:"noDataState"`
	ExecErrState         string                 `json:"execErrState"`
	For                  time.Duration          `json:"for"`
	Annotations          map[string]string      `json:"annotations"`
	Labels               map[string]string      `json:"labels"`
	IsPaused             bool                   `json:"isPaused"`
	NotificationSettings []notificationSettings `json:"notificationSettings"`
}

type alertQuery struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId"`

	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string `json:"queryType"`

	// RelativeTimeRange is the relative Start and End of the query as sent by the frontend.
	RelativeTimeRange relativeTimeRange `json:"relativeTimeRange"`

	// Grafana data source unique identifier; it should be '__expr__' for a Server Side Expression operation.
	DatasourceUID string `json:"datasourceUid"`

	// JSON is the raw JSON query and includes the above properties as well as custom properties.
	Model json.RawMessage `json:"model"`
}

func alertQueryFromModel(query models.AlertQuery) alertQuery {
	return alertQuery{
		RefID:     query.RefID,
		QueryType: query.QueryType,
		RelativeTimeRange: relativeTimeRange{
			From: duration(query.RelativeTimeRange.From),
			To:   duration(query.RelativeTimeRange.To),
		},
		DatasourceUID: query.DatasourceUID,
		Model:         query.Model,
	}
}

type relativeTimeRange struct {
	From duration `json:"from"`
	To   duration `json:"to"`
}

// duration is a type used for marshalling durations.
type duration time.Duration

func (d duration) String() string {
	return time.Duration(d).String()
}

func (d duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).Seconds())
}

func (d *duration) UnmarshalJSON(b []byte) error {
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case float64:
		*d = duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}

func (d duration) MarshalYAML() (any, error) {
	return time.Duration(d).Seconds(), nil
}

func (d *duration) UnmarshalYAML(unmarshal func(any) error) error {
	var v any
	if err := unmarshal(&v); err != nil {
		return err
	}
	switch value := v.(type) {
	case int:
		*d = duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}

type notificationSettings struct {
	Receiver          string   `json:"receiver"`
	GroupBy           []string `json:"group_by,omitempty"`
	GroupWait         duration `json:"group_wait,omitempty"`
	GroupInterval     duration `json:"group_interval,omitempty"`
	RepeatInterval    duration `json:"repeat_interval,omitempty"`
	MuteTimeIntervals []string `json:"mute_time_intervals,omitempty"`
}

func notificationSettingsFromModel(settings models.NotificationSettings) notificationSettings {
	var (
		groupWait      duration
		groupInterval  duration
		repeatInterval duration
	)
	if settings.GroupWait != nil {
		groupWait = duration(*settings.GroupWait)
	}
	if settings.GroupInterval != nil {
		groupInterval = duration(*settings.GroupInterval)
	}
	if settings.RepeatInterval != nil {
		repeatInterval = duration(*settings.RepeatInterval)
	}

	return notificationSettings{
		Receiver:          settings.Receiver,
		GroupBy:           settings.GroupBy,
		GroupWait:         groupWait,
		GroupInterval:     groupInterval,
		RepeatInterval:    repeatInterval,
		MuteTimeIntervals: settings.MuteTimeIntervals,
	}
}

type record struct {
	// Metric indicates a metric name to send results to.
	Metric string `json:"metric"`
	// From contains a query RefID, indicating which expression node is the output of the recording rule.
	From string `json:"from"`
}

func recordFromModel(input *models.Record) *record {
	if input == nil {
		return nil
	}

	return &record{
		Metric: input.Metric,
		From:   input.From,
	}
}

type contactPoint struct {
	UID                   string `json:"uid"`
	Name                  string `json:"name"`
	Type                  string `json:"type"`
	Settings              any    `json:"settings"`
	DisableResolveMessage bool   `json:"disableResolveMessage"`
	Provenance            string `json:"provenance"`
}

type notificationTemplate struct {
	UID             string `json:"uid"`
	Name            string `json:"name"`
	Template        string `json:"template"`
	Provenance      string `json:"provenance,omitempty"`
	ResourceVersion string `json:"version,omitempty"`
}

type muteTimeInterval struct {
	UID           string         `json:"uid"`
	Name          string         `json:"name"`
	TimeIntervals []timeInterval `json:"time_intervals"`
	Version       string         `json:"version,omitempty"`
	Provenance    string         `json:"provenance,omitempty"`
}

func muteTimeIntervalFromModel(timeInterval *definitions.MuteTimeInterval) muteTimeInterval {
	return muteTimeInterval{
		UID:           timeInterval.UID,
		Name:          timeInterval.Name,
		TimeIntervals: slicesext.Map(timeInterval.TimeIntervals, timeIntervalFromModel),
		Version:       timeInterval.Version,
		Provenance:    string(timeInterval.Provenance),
	}
}

type timeInterval struct {
	Times       []timeRange      `yaml:"times,omitempty" json:"times,omitempty"`
	Weekdays    []inclusiveRange `yaml:"weekdays,flow,omitempty" json:"weekdays,omitempty"`
	DaysOfMonth []inclusiveRange `yaml:"days_of_month,flow,omitempty" json:"days_of_month,omitempty"`
	Months      []inclusiveRange `yaml:"months,flow,omitempty" json:"months,omitempty"`
	Years       []inclusiveRange `yaml:"years,flow,omitempty" json:"years,omitempty"`
	Location    *time.Location   `yaml:"location,flow,omitempty" json:"location,omitempty"`
}

func timeIntervalFromModel(interval timeinterval.TimeInterval) timeInterval {
	var location *time.Location
	if interval.Location != nil {
		location = interval.Location.Location
	}
	return timeInterval{
		Times: slicesext.Map(interval.Times, func(v timeinterval.TimeRange) timeRange {
			return timeRange{
				StartMinute: v.StartMinute,
				EndMinute:   v.EndMinute,
			}
		}),
		Weekdays: slicesext.Map(interval.Weekdays, func(v timeinterval.WeekdayRange) inclusiveRange {
			return inclusiveRange{
				Begin: v.Begin,
				End:   v.End,
			}
		}),
		DaysOfMonth: slicesext.Map(interval.DaysOfMonth, func(v timeinterval.DayOfMonthRange) inclusiveRange {
			return inclusiveRange{
				Begin: v.Begin,
				End:   v.End,
			}
		}),
		Months: slicesext.Map(interval.Months, func(v timeinterval.MonthRange) inclusiveRange {
			return inclusiveRange{
				Begin: v.Begin,
				End:   v.End,
			}
		}),
		Years: slicesext.Map(interval.Years, func(v timeinterval.YearRange) inclusiveRange {
			return inclusiveRange{
				Begin: v.Begin,
				End:   v.End,
			}
		}),
		Location: location,
	}
}

type timeRange struct {
	StartMinute int
	EndMinute   int
}

type inclusiveRange struct {
	Begin int
	End   int
}

func (s *Service) getMigrationDataJSON(ctx context.Context, signedInUser *user.SignedInUser) (*cloudmigration.MigrateDataRequest, error) {
	// Data sources
	dataSources, err := s.getDataSourceCommands(ctx)
	if err != nil {
		s.log.Error("Failed to get datasources", "err", err)
		return nil, err
	}

	// Dashboards and folders are linked via the schema, so we need to get both
	dashs, folders, err := s.getDashboardAndFolderCommands(ctx, signedInUser)
	if err != nil {
		s.log.Error("Failed to get dashboards and folders", "err", err)
		return nil, err
	}

	migrationDataSlice := make(
		[]cloudmigration.MigrateDataRequestItem, 0,
		len(dataSources)+len(dashs)+len(folders),
	)

	for _, ds := range dataSources {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.DatasourceDataType,
			RefID: ds.UID,
			Name:  ds.Name,
			Data:  ds,
		})
	}

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
	}

	folders = sortFolders(folders)
	for _, f := range folders {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.FolderDataType,
			RefID: f.UID,
			Name:  f.Title,
			Data:  f,
		})
	}

	// Fetch alerting resources.

	fmt.Printf("\n\naaaaaaa -- BUILD SNAPSHOTL orgID=%+v\n\n", signedInUser.OrgID)

	alertRules, provenance, err := s.ngalert.Api.AlertRules.GetAlertRules(ctx, signedInUser)
	if err != nil {
		return nil, fmt.Errorf("fetching alert rules from store: %w", err)
	}

	fmt.Printf("\n\naaaaaaa provenance %+v\n\n", provenance)

	fmt.Printf("\n\naaaaaaa len(alertRules) %+v\n\n", len(alertRules))
	for _, rule := range alertRules {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.AlertRuleType,
			RefID: rule.UID,
			Name:  rule.Title,
			Data: alertRule{
				ID:           rule.ID,
				UID:          rule.UID,
				OrgID:        rule.OrgID,
				NamespaceUID: rule.NamespaceUID,
				RuleGroup:    rule.RuleGroup,
				Title:        rule.Title,
				Condition:    rule.Condition,
				Data: slicesext.Map(rule.Data, func(query models.AlertQuery) alertQuery {
					return alertQueryFromModel(query)
				}),
				Updated:      rule.Updated,
				NoDataState:  rule.NoDataState.String(),
				ExecErrState: rule.ExecErrState.String(),
				For:          rule.For,
				Annotations:  rule.Annotations,
				Labels:       rule.Labels,
				IsPaused:     rule.IsPaused,
				NotificationSettings: slicesext.Map(rule.NotificationSettings, func(settings models.NotificationSettings) notificationSettings {
					return notificationSettingsFromModel(settings)
				}),
				Record: recordFromModel(rule.Record),
			},
		})
	}

	contactPoints, err := s.ngalert.Api.ContactPointService.GetContactPoints(ctx, provisioning.ContactPointQuery{OrgID: signedInUser.OrgID, Decrypt: true}, signedInUser)
	if err != nil {
		return nil, fmt.Errorf("fetching contacts points: %w", err)
	}
	fmt.Printf("\n\naaaaaaa contactPoints %+v\n\n", contactPoints)
	fmt.Printf("\n\naaaaaaa contactPoints[0] %+v\n\n", contactPoints[0].Settings)

	for _, contact := range contactPoints {
		fmt.Printf("\n\naaaaaaa contact.Name %+v\n\n", contact.Name)
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.ContactPointType,
			RefID: contact.UID,
			Name:  contact.Name,
			Data: contactPoint{
				UID:                   contact.UID,
				Name:                  contact.Name,
				Type:                  contact.Type,
				Settings:              contact.Settings.Interface(),
				DisableResolveMessage: contact.DisableResolveMessage,
				Provenance:            contact.Provenance,
			},
		})
	}

	notificationPolicies, err := s.ngalert.Api.Policies.GetPolicyTree(ctx, signedInUser.OrgID)
	if err != nil {
		return nil, fmt.Errorf("fetching alerting notification policies: %w", err)
	}
	fmt.Printf("\n\naaaaaaa notificationPolicies %+v\n\n", notificationPolicies)
	notificationPoliciesJSONbytes, _ := json.MarshalIndent(notificationPolicies, "", "  ")
	fmt.Printf("\n\naaaaaaa notificationPolicies JSON %+v\n\n", string(notificationPoliciesJSONbytes))
	migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
		Type:  cloudmigration.NotificationPolicyType,
		RefID: notificationPolicies.ResourceID(),
		Name:  notificationPolicies.Receiver,
		// TODO: create a model for this.
		Data: notificationPolicies,
	})

	notificationTemplates, err := s.ngalert.Api.Templates.GetTemplates(ctx, signedInUser.OrgID)
	if err != nil {
		return nil, fmt.Errorf("fetching alerting notification templates: %w", err)
	}
	fmt.Printf("\n\naaaaaaa notificationTemplates %+v\n\n", notificationTemplates)
	for _, template := range notificationTemplates {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.NotificationTemplateType,
			RefID: template.UID,
			Name:  template.Name,
			Data: notificationTemplate{
				UID:             template.UID,
				Name:            template.Name,
				Template:        template.Template,
				Provenance:      string(template.Provenance),
				ResourceVersion: template.ResourceVersion,
			},
		})
	}

	muteTimings, err := s.ngalert.Api.MuteTimings.GetMuteTimings(ctx, signedInUser.OrgID)
	if err != nil {
		return nil, fmt.Errorf("fetching alert mute timings: %w", err)
	}
	fmt.Printf("\n\naaaaaaa muteTimings %+v\n\n", muteTimings)
	for _, muteTiming := range muteTimings {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.MuteTimingType,
			RefID: muteTiming.UID,
			Name:  muteTiming.Name,
			Data:  muteTimeIntervalFromModel(&muteTiming),
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

// getDashboardAndFolderCommands returns the json payloads required by the dashboard and folder creation APIs
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
	fmt.Printf("\n\naaaaaaa snapshotMeta.LocalDir %+v\n\n", snapshotMeta.LocalDir)

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

		localSnapshotResource[i] = cloudmigration.CloudMigrationResource{
			Name:   item.Name,
			Type:   item.Type,
			RefID:  item.RefID,
			Status: cloudmigration.ItemStatusPending,
		}
	}

	for _, resourceType := range []cloudmigration.MigrateDataType{
		cloudmigration.DatasourceDataType,
		cloudmigration.FolderDataType,
		cloudmigration.DashboardDataType,
		cloudmigration.AlertRuleType,
		cloudmigration.ContactPointType,
		cloudmigration.NotificationPolicyType,
		cloudmigration.NotificationTemplateType,
		cloudmigration.MuteTimingType,
	} {
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
		UID:       snapshotMeta.UID,
		SessionID: snapshotMeta.SessionUID,
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
		UID:       snapshotMeta.UID,
		SessionID: snapshotMeta.SessionUID,
		Status:    cloudmigration.SnapshotStatusProcessing,
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
		s.log.Error("failed to update snapshot status", "snapshotUid", cmd.UID, "status", cmd.Status, "num_resources", len(cmd.Resources), "error", err.Error())
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
