# Grafana Analytics Events Documentation

This document catalogs all analytics events tracked in the Grafana codebase using Rudderstack and other analytics backends.

## Analytics Architecture Overview

Grafana uses a centralized analytics system called EchoSrv that supports multiple backends:
- **RudderstackBackend**: Primary analytics backend using Rudderstack
- **GA4Backend**: Google Analytics 4 integration
- **GABackend**: Legacy Google Analytics integration
- **ApplicationInsightsBackend**: Microsoft Application Insights
- **BrowserConsoleBackend**: Console logging for development
- **MetaAnalyticsBackend**: Internal meta analytics

## Core Analytics Functions

### Primary Functions
- `reportInteraction(eventName, properties)` - Track user interactions
- `reportPageview()` - Track page views
- `reportMetaAnalytics(payload)` - Track meta analytics events (dashboard views, data requests)
- `reportExperimentView(id, group, variant)` - Track A/B test experiments

### Wrapper Functions
- `queryLibraryInteraction(event, properties)` - Query library specific events
- `reportInteractionOnce(eventName, properties)` - Track interaction only once per session
- `reportAutoGenerateInteraction(src, item, otherMeta)` - GenAI interactions

## Analytics Events by Category

### Dashboard Analytics

#### Dashboard View Events
**Event**: `dashboard-view` (MetaAnalytics)
**Function**: `emitDashboardViewEvent(dashboard)`
**Location**: `public/app/features/dashboard/state/analyticsProcessor.ts`
**Properties**:
- `dashboardId` (deprecated)
- `dashboardUid`
- `dashboardName`
- `folderName`
- `eventName: 'dashboard-view'`

#### Dashboard Interactions
**Prefix**: `dashboards_`
**Location**: `public/app/features/dashboard-scene/utils/interactions.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `dashboards_init_dashboard_completed` | Custom properties | Dashboard initialization |
| `dashboards_panelheader_datalink_clicked` | Custom properties | Panel link clicks |
| `dashboards_panelheader_statusmessage_clicked` | Custom properties | Panel status message clicks |
| `dashboards_panelheader_cancelquery_clicked` | Custom properties | Panel query cancellation |
| `dashboards_toolbar_actions_clicked` | `item: 'favorites'/'settings'/'share'/'share_dropdown'/'add'` | Toolbar actions |
| `dashboards_emptydashboard_clicked` | Custom properties | Empty dashboard state interactions |
| `dashboards_toolbar_add_clicked` | Custom properties | Add button clicks |
| `dashboards_version_restore_clicked` | `version`, `index?`, `confirm`, `version_date?` | Version restore |
| `dashboards_show_more_versions_clicked` | None | Show more versions |
| `dashboards_dashboard_image_generated` | Custom properties | Image generation |
| `dashboards_dashboard_image_downloaded` | Custom properties | Image download |

#### Dashboard Sharing Events
**Prefix**: `dashboards_sharing_`
**Location**: `public/app/features/dashboard-scene/utils/interactions.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `dashboards_sharing_category_clicked` | Custom properties | Sharing category selection |
| `dashboards_sharing_link_copy_clicked` | Custom properties | Link copying |
| `dashboards_sharing_embed_copy_clicked` | Custom properties | Embed code copying |
| `dashboards_sharing_link_generate_image_clicked` | Custom properties | Generate panel image |
| `dashboards_sharing_link_download_image_clicked` | Custom properties | Download panel image |
| `dashboards_sharing_snapshot_publish_clicked` | Custom properties | Publish snapshot |
| `dashboards_sharing_snapshot_local_clicked` | Custom properties | Local snapshot |
| `dashboards_sharing_export_download_json_clicked` | Custom properties | JSON export download |
| `dashboards_sharing_export_copy_json_clicked` | Custom properties | JSON export copy |
| `dashboards_sharing_export_save_json_clicked` | Custom properties | JSON export save |
| `dashboards_sharing_export_view_json_clicked` | Custom properties | JSON export view |
| `dashboards_sharing_public_generate_url_clicked` | Custom properties | Public dashboard URL generation |
| `dashboards_sharing_public_email_revoke_clicked` | Custom properties | Public dashboard email revocation |
| `dashboards_sharing_public_email_resend_clicked` | Custom properties | Public dashboard email resend |
| `dashboards_sharing_public_email_invite_clicked` | Custom properties | Public dashboard email invite |
| `dashboards_sharing_public_can_view_clicked` | Custom properties | Public dashboard view settings |
| `dashboards_sharing_public_time_picker_clicked` | Custom properties | Public dashboard time picker |
| `dashboards_sharing_public_annotations_clicked` | Custom properties | Public dashboard annotations |
| `dashboards_sharing_public_copy_url_clicked` | Custom properties | Public dashboard URL copy |
| `dashboards_sharing_public_pause_clicked` | Custom properties | Public dashboard pause |
| `dashboards_sharing_public_revoke_clicked` | Custom properties | Public dashboard revocation |
| `dashboards_sharing_report_create_clicked` | None | Report creation |
| `dashboards_sharing_pdf_save_clicked` | Custom properties | PDF save |

#### Dashboard GenAI Events
**Event**: `dashboards_autogenerate_clicked`
**Location**: `public/app/features/dashboard/components/GenAI/tracking.ts`
**Properties**:
- `src`: Source of interaction (panel-description, panel-title, dashboard-changes, etc.)
- `item`: Type of interaction (auto-generate-button, improve-button, etc.)
- Custom metadata

### Data Request Analytics

#### Data Request Events
**Event**: `data-request` (MetaAnalytics)
**Function**: `emitDataRequestEvent(datasource)`
**Location**: `public/app/features/query/state/queryAnalytics.ts`
**Properties**:
- `eventName: 'data-request'`
- `source`: Application source (dashboard, explore, etc.)
- `datasourceName`
- `datasourceId`
- `datasourceUid`
- `datasourceType`
- `dataSize`
- `panelId`
- `panelPluginId`
- `panelName`
- `duration`
- `error` (if applicable)
- `totalQueries`
- `cachedQueries`

### Query Library Analytics

**Prefix**: `query_library-`
**Location**: `public/app/extensions/query-library/QueryLibraryAnalyticsEvents.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `query_library-opened` | Custom properties | Library opened |
| `query_library-closed_without_selection` | Custom properties | Closed without selection |
| `query_library-closed_without_saving_new_query` | None | Closed without saving |
| `query_library-add_query_from_library_clicked` | Custom properties | Add query from library |
| `query_library-replace_with_query_from_library_clicked` | Custom properties | Replace with library query |
| `query_library-save_query_to_library_clicked` | Custom properties | Save to library |
| `query_library-cancel_save_new_query_clicked` | Custom properties | Cancel save |
| `query_library-save_query_success` | Custom properties | Successful save |
| `query_library-edit_in_explore_clicked` | Custom properties | Edit in explore |
| `query_library-update_query_from_explore_completed` | Custom properties | Update from explore |
| `query_library-search_bar_focused` | Custom properties | Search interaction |
| `query_library-data_source_filter_changed` | Custom properties | Filter changes |
| `query_library-user_filter_changed` | Custom properties | User filter |
| `query_library-sorting_option_changed` | Custom properties | Sorting |
| `query_library-tag_filter_changed` | Custom properties | Tag filtering |
| `query_library-select_query_clicked` | Custom properties | Query selection |
| `query_library-delete_query_clicked` | Custom properties | Query deletion |
| `query_library-duplicate_query_clicked` | Custom properties | Query duplication |
| `query_library-save_recent_query_clicked` | Custom properties | Save recent query |
| `query_library-lock_query_clicked` | Custom properties | Lock query |
| `query_library-edit_query_clicked` | Custom properties | Edit query |
| `query_library-cancel_edit_clicked` | Custom properties | Cancel edit |
| `query_library-save_edit_clicked` | Custom properties | Save edit |
| `query_library-query_library_closed_to_edit_query_in_explore` | Custom properties | Close to edit in explore |

### Logs Analytics

#### Log Controls Events
**Prefix**: `logs_log_list_controls_`
**Location**: `public/app/features/logs/components/panel/LogListControls.tsx`

| Event Name | Properties | Context |
|------------|------------|---------|
| `logs_log_list_controls_scroll_top_clicked` | None | Scroll to top |
| `logs_log_list_controls_scroll_bottom_clicked` | None | Scroll to bottom |
| `logs_log_list_controls_force_escape_clicked` | None | Force escape |
| `logs_log_list_controls_level_clicked` | `level` | Log level selection |
| `logs_log_list_controls_font_size_clicked` | `fontSize` | Font size change |
| `logs_log_list_controls_show_time_clicked` | `showTime` | Toggle time display |
| `logs_log_list_controls_show_unique_labels_clicked` | `showUniqueLabels` | Toggle unique labels |
| `logs_log_list_controls_sort_order_clicked` | `sortOrder` | Sort order change |
| `logs_log_list_controls_prettify_json_clicked` | `prettifyLogMessage` | JSON prettify |
| `logs_log_list_controls_syntax_clicked` | `logsSortOrder` | Syntax highlighting |
| `logs_log_list_controls_wrap_clicked` | `wrapLogMessage` | Text wrapping |
| `logs_log_list_controls_deduplication_clicked` | `dedupStrategy` | Deduplication strategy |
| `logs_log_list_controls_downloaded_logs` | `format`, `logCount` | Log downloads |

#### Explore Logs Events
**Event**: `grafana_explore_logs_popover_menu`
**Location**: `public/app/features/explore/Logs/PopoverMenu.tsx`
**Properties**:
- `action`: copy, line_contains, line_does_not_contain, popover_menu_disabled
- `selectionLength`: Number
- `dataSourceType`: String

### Alerting Analytics

#### Alert Enrichment Events
**Prefix**: `grafana_alerting_enrichment_`
**Location**: `public/app/extensions/alerting/enrichment/analytics/Analytics.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_alerting_enrichment_list_view` | `enrichments_count`, `has_enrichments` | List view |
| `grafana_alerting_enrichment_load_more` | `current_count` | Load more |
| `grafana_alerting_enrichment_creation_started` | None | Creation started |
| `grafana_alerting_enrichment_saved` | `enricher_type`, `has_label_matchers`, `has_annotation_matchers`, `steps_count`, `scope_type`, `form_action` | Save operation |
| `grafana_alerting_enrichment_form_error` | `form_action`, `error_field?` | Form errors |
| `grafana_alerting_enrichment_deleted` | Enrichment tracking props | Deletion |
| `grafana_alerting_enrichment_edit_clicked` | Enrichment tracking props | Edit action |

#### AI Alerting Events
**Prefix**: `grafana_alerting_ai_`
**Location**: `public/app/extensions/alerting/AI/analytics/tracking.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_alerting_ai_alert_rule_button_click` | None | AI button click |
| `grafana_alerting_ai_alert_rule_generation` | `success`, `hasTools?`, `error?` | Rule generation |
| `grafana_alerting_ai_alert_rule_used` | None | Rule used |
| `grafana_alerting_ai_alert_rule_cancelled` | None | Rule cancelled |
| `grafana_alerting_ai_alert_rule_feedback` | `helpful`, `comment?`, `timeToFeedback?` | Feedback |
| `grafana_alerting_ai_template_button_click` | None | Template button |
| `grafana_alerting_ai_template_generation` | `success`, `error?` | Template generation |
| `grafana_alerting_ai_template_used` | None | Template used |
| `grafana_alerting_ai_template_cancelled` | None | Template cancelled |
| `grafana_alerting_ai_template_feedback` | `helpful`, `comment?`, `timeToFeedback?` | Template feedback |
| `grafana_alerting_ai_improve_labels_button_click` | None | Improve labels button |
| `grafana_alerting_ai_improve_labels_generation` | `success`, `error?` | Labels generation |
| `grafana_alerting_ai_improve_labels_applied` | None | Labels applied |
| `grafana_alerting_ai_improve_labels_cancelled` | None | Labels cancelled |
| `grafana_alerting_ai_improve_annotations_button_click` | None | Improve annotations button |
| `grafana_alerting_ai_improve_annotations_generation` | `success`, `error?` | Annotations generation |
| `grafana_alerting_ai_improve_annotations_applied` | None | Annotations applied |
| `grafana_alerting_ai_improve_annotations_cancelled` | None | Annotations cancelled |
| `grafana_alerting_ai_triage_button_click` | `provider` | Triage button |
| `grafana_alerting_ai_triage_generation` | `success`, `logRecordsCount?`, `error?` | Triage generation |
| `grafana_alerting_ai_triage_feedback` | `helpful`, `comment?`, `timeToFeedback?` | Triage feedback |

### Authentication Analytics

#### SAML Configuration Events
**Prefix**: `authentication_saml_`
**Location**: `public/app/extensions/auth-config/SAML/SAMLForm.tsx`

| Event Name | Properties | Context |
|------------|------------|---------|
| `authentication_saml_step` | `step`, `enabled` | Configuration steps |
| `authentication_saml_saved` | `enabled` | Configuration saved |
| `authentication_saml_enabled` | `enabled: true` | SAML enabled |
| `authentication_saml_disabled` | `enabled: false` | SAML disabled |
| `authentication_saml_abandoned` | `enabled` | Configuration abandoned |
| `authentication_saml_removed` | `enabled` | Configuration removed |

### Reports Analytics

#### Report Events
**Prefix**: `reports_`
**Location**: Multiple report-related files

| Event Name | Properties | Context |
|------------|------------|---------|
| `reports_preview_pdf` | None | PDF preview |
| `reports_report_submitted` | Report properties | Report submission |
| `reports_draft_saved` | Report properties | Draft saved |
| `reports_report_abandoned` | Report properties | Report abandoned |

### Data Downloads Analytics

#### Download Events
**Location**: `public/app/features/inspector/InspectDataTab.tsx`

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_logs_download_clicked` | `app`, `format: 'csv'` | CSV download |
| `grafana_logs_download_logs_clicked` | `app`, `format`, `count` | Log download |
| `grafana_traces_download_traces_clicked` | `app`, `format`, `count` | Trace download |
| `grafana_traces_download_service_graph_clicked` | `app`, `format` | Service graph download |

### Management Analytics

#### Dashboard Management Events
**Event**: `grafana_manage_dashboards_delete_clicked`
**Location**: `public/app/features/browse-dashboards/components/BrowseActions/DeleteModal.tsx`
**Properties**:
- `item_counts`: Object with counts

#### Banner Management Events
**Event**: `grafana_banner_saved`
**Location**: `public/app/extensions/announcement-banner/BannerForm.tsx`
**Properties**:
- `enabled`: Boolean

### Plugin Analytics

#### Sandbox Events
**Event**: `plugins_sandbox_switch`
**Location**: `public/app/extensions/plugins/sandbox/FrontendSandboxSwitch.tsx`
**Properties**:
- `enabled`: Boolean

#### File Upload Events
**Event**: `grafana_datasource_drop_files`
**Location**: `public/app/plugins/datasource/grafana/components/QueryEditor.tsx`
**Properties**:
- `fileCount`: Number

### Cloud Analytics

#### Recorded Queries Events
**Prefix**: `cloud_user_`
**Location**: `public/app/extensions/recorded-queries/`

| Event Name | Properties | Context |
|------------|------------|---------|
| `cloud_user_clicked_add_selected_recorded_queries` | `count` | Add selected queries |
| `cloud_user_clicked_add_recorded_query_button` | None | Add query button |
| `cloud_user_clicked_create_recorded_query_modal_documentation_icon` | `datasourceType` | Documentation click |
| `cloud_user_created_recorded_query` | None | Query created |
| `cloud_user_clicked_create_recorded_query_icon` | None | Create icon click |

### Experiment Analytics

#### A/B Test Events
**Event**: `experiment_viewed` (Rudderstack direct)
**Location**: `public/app/core/services/echo/backends/analytics/RudderstackBackend.ts`
**Properties**:
- `experiment_id`
- `experiment_group`
- `experiment_variant`

### Page View Analytics

#### Page Views
**Event Type**: Pageview
**Function**: `reportPageview()`
**Backend**: All analytics backends
**Properties**:
- `page`: Full page path with query parameters and hash

## Implementation Notes

### Rudderstack Integration
- Events are sent to Rudderstack via the `RudderstackBackend` class
- Interaction events use `window.rudderanalytics.track(eventName, properties)`
- Page views use `window.rudderanalytics.page()`
- Experiment views are tracked as `experiment_viewed` events

### Property Validation
- Event properties should only be string, number, boolean, or undefined
- Invalid property types trigger console warnings in development
- Properties are merged with static reporting context from config

### Session-based Tracking
- Some events use `reportInteractionOnce()` to track only once per session
- Session storage is used to prevent duplicate tracking

### Context Enhancement
- Dashboard events include scene context (`scenesView: true`) when applicable
- Events include feature toggle context (`isDynamicDashboard`)
- Static reporting context is automatically merged into properties

### Explore Analytics

#### Explore Logs Events
**Prefix**: `grafana_explore_logs_`
**Location**: Various explore log components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_explore_logs_visualisation_changed` | `visualisation` | Log visualization change |
| `grafana_explore_logs_deduplication_clicked` | `deduplicationCount` | Deduplication interaction |
| `grafana_explore_logs_histogram_toggle_clicked` | `enabled` | Histogram toggle |
| `grafana_explore_logs_scanning_button_clicked` | `type` | Log scanning |
| `grafana_explore_logs_permalink_clicked` | Custom properties | Permalink generation |
| `grafana_explore_logs_infinite_pagination_clicked` | `direction` | Infinite scroll pagination |
| `grafana_explore_logs_log_details_replace_line_clicked` | `key`, `type` | Log line replacement |
| `grafana_explore_logs_log_details_filter_clicked` | `key`, `type` | Log detail filtering |
| `grafana_explore_logs_log_details_stats_clicked` | `key` | Log statistics view |
| `grafana_explore_logs_popover_menu` | `action`, `selectionLength`, `dataSourceType` | Popover menu actions |

#### Explore Prometheus Events
**Prefix**: `grafana_prom_` / `user_grafana_prometheus_`
**Location**: Prometheus query builder components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_prom_kickstart_your_query_selected` | `query` | Query pattern selection |
| `grafana_prom_kickstart_toggle_pattern_card` | `expanded`, `query` | Pattern card toggle |
| `user_grafana_prometheus_editor_mode_clicked` | `mode` | Editor mode change |
| `grafana_prometheus_open_kickstart_clicked` | None | Kickstart modal opening |
| `grafana_explore_prometheus_instant_query_ui_raw_toggle_expand` | Custom properties | Raw query expansion |

### Trace Analytics

#### Trace Events
**Prefix**: `grafana_traces_`
**Location**: Trace-related components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_traces_download_traces_clicked` | `app`, `format`, `count` | Trace download |
| `grafana_traces_query_type_changed` | `query_type`, `editor_mode` | Query type change |
| `grafana_traces_copy_to_traceql_clicked` | `query` | TraceQL conversion |
| `grafana_traces_cheatsheet_clicked` | `cheatsheet_type` | Cheat sheet interaction |
| `grafana_traces_traceID_expand_collapse_clicked` | `action` | Trace expansion/collapse |
| `grafana_traces_trace_view_span_link_clicked` | `datasourceType` | Span link clicks |

### Data Source Analytics

#### Loki Events
**Prefix**: `grafana_loki_`
**Location**: Loki data source components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_loki_max_lines_changed` | `maxLines` | Max lines setting |
| `grafana_loki_query_patterns_selected` | `queryPattern` | Query pattern selection |
| `grafana_loki_editor_mode_clicked` | `mode` | Editor mode change |
| `grafana_loki_cheatsheet_example_clicked` | None | Cheat sheet usage |

#### Azure Monitor Events
**Prefix**: `grafana_azure_` / `grafana_ds_azuremonitor_`
**Location**: Azure Monitor components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_azure_cheatsheet_logs_query_selected` | `query` | Query selection from cheat sheet |
| `grafana_ds_azuremonitor_subscriptions_loaded` | `subscriptions` | Subscription loading |

#### SQL Events
**Prefix**: `grafana_sql_`
**Location**: SQL editor components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_sql_editor_mode_changed` | `mode`, `datasourceType` | SQL editor mode change |
| `grafana_sql_format_changed` | `format` | SQL format change |

#### Cloud Monitoring Events
**Event**: `grafana_cloud_monitoring_config_changed`
**Location**: Cloud Monitoring configuration
**Properties**:
- `config_type`

### FlameGraph Analytics

#### FlameGraph Events
**Prefix**: `grafana_flamegraph_`
**Location**: FlameGraph components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_flamegraph_*` | Custom context | Various flamegraph interactions |

### Search and Browse Analytics

#### Search Events
**Prefix**: `manage_dashboards_` / `dashboard_search_`
**Location**: `public/app/features/search/page/reporting.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `manage_dashboards_viewed` | Search context properties | Dashboard list viewed |
| `manage_dashboards_result_clicked` | Search context properties | Search result clicked |
| `manage_dashboards_query_submitted` | Search context properties | Search query submitted |
| `manage_dashboards_query_failed` | Search context + error | Search query failed |
| `dashboard_search_viewed` | Search context properties | Dashboard search viewed |
| `dashboard_search_result_clicked` | Search context properties | Search result clicked |
| `dashboard_search_query_submitted` | Search context properties | Search query submitted |
| `dashboard_search_query_failed` | Search context + error | Search query failed |

#### Browse Dashboard Events
**Location**: Various browse dashboard components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_empty_state_shown` | `source: 'browse_dashboards'` | Empty state display |
| `grafana_browse_dashboards_page_edit_folder_name` | `status` | Folder name editing |
| `grafana_browse_dashboards_page_button_to_recently_deleted` | Custom properties | Recently deleted navigation |
| `grafana_manage_dashboards_item_moved` | Custom properties | Dashboard item moved |
| `grafana_manage_dashboards_item_deleted` | Custom properties | Dashboard item deleted |
| `grafana_restore_clicked` | Custom properties | Dashboard restoration |
| `grafana_menu_item_clicked` | `item` | Menu item clicks |

### Panel Inspector Analytics

#### Panel Inspector Events
**Prefix**: `grafana_panel_inspect_`
**Location**: `public/app/features/search/page/reporting.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_panel_inspect_[TAB]_[ACTION]_clicked` | Custom properties | Panel inspector interactions |

### Query Editor Analytics

#### Query Editor Events
**Location**: Query editor components

| Event Name | Properties | Context |
|------------|------------|---------|
| `query_library-update_query_from_explore_cancelled` | Custom properties | Query update cancellation |
| `query_editor_row_hide_query_clicked` | Custom properties | Query row hiding |

### Log Details Analytics

#### Log Details Events
**Prefix**: `logs_log_line_details_`
**Location**: Log details components

| Event Name | Properties | Context |
|------------|------------|---------|
| `logs_log_line_details_sidebar_resized` | `width` | Sidebar resizing |
| `logs_log_line_details_displayed` | `fieldCount` | Log details display |

### Public Dashboard Analytics

#### Public Dashboard Events
**Event**: `grafana_dashboards_public_enable_clicked`
**Location**: Public dashboard management
**Properties**:
- `enabled`: Boolean

### Dashboard Save Analytics

#### Dashboard Save Events
**Location**: Dashboard save components

| Event Name | Properties | Context |
|------------|------------|---------|
| `grafana_dashboard_created` | Dashboard properties | New dashboard creation |
| `grafana_dashboard_saved` | Dashboard properties | Dashboard save |

### Query Builder Analytics

#### Query Builder Events
**Event**: `grafana_query_builder_hints_clicked`
**Location**: Query builder components
**Properties**:
- `hint_type`

### Extension Analytics

#### Extension Events
**Event**: `grafana_extension_sidebar_changed`
**Location**: Extension sidebar
**Properties**:
- `extension_id`, `isOpen`

### Import Analytics

#### Import Events
**Event**: `grafana_dashboard_import_finished`
**Location**: Dashboard import components

### Report Analytics (Extended)

#### Report V2 Events
**Prefix**: `report_`
**Location**: `public/app/extensions/reports/ReportFormV2/reportingInteractions.ts`

| Event Name | Properties | Context |
|------------|------------|---------|
| `report_save_clicked` | Report properties + context | Report save |
| `report_save_draft_clicked` | Report properties + context | Draft save |
| `report_send_preview_clicked` | Context + custom properties | Preview send |
| `report_download_csv_clicked` | Context + custom properties | CSV download |
| `report_preview_pdf_clicked` | Context + custom properties | PDF preview |
| `report_settings_clicked` | Context + custom properties | Settings access |
| `report_send_clicked` | Context + custom properties | Report send |
| `report_delete_clicked` | Context + custom properties | Report deletion |
| `report_pause_clicked` | Context + custom properties | Report pause |
| `report_resume_clicked` | Context + custom properties | Report resume |
| `report_discard_clicked` | Context | Report discard |

## Configuration

Analytics backends are configured in `public/app/app.ts` based on configuration:
- `config.rudderstackWriteKey` and `config.rudderstackDataPlaneUrl` for Rudderstack
- `config.googleAnalytics4Id` for GA4
- `config.applicationInsightsConnectionString` for Application Insights
- `config.analyticsConsoleReporting` for console logging

## Complete Event Name List

### All reportInteraction Event Names (Alphabetical)

#### A-C
- `authentication_saml_abandoned`
- `authentication_saml_disabled`
- `authentication_saml_enabled`
- `authentication_saml_removed`
- `authentication_saml_saved`
- `authentication_saml_step`
- `cloud_user_clicked_add_recorded_query_button`
- `cloud_user_clicked_add_selected_recorded_queries`
- `cloud_user_clicked_create_recorded_query_icon`
- `cloud_user_clicked_create_recorded_query_modal_documentation_icon`
- `cloud_user_created_recorded_query`

#### D-G
- `dashboards_autogenerate_clicked`
- `dashboards_dashboard_image_downloaded`
- `dashboards_dashboard_image_generated`
- `dashboards_emptydashboard_clicked`
- `dashboards_init_dashboard_completed`
- `dashboards_panelheader_cancelquery_clicked`
- `dashboards_panelheader_datalink_clicked`
- `dashboards_panelheader_statusmessage_clicked`
- `dashboards_sharing_*` (see Dashboard Sharing Events above)
- `dashboards_show_more_versions_clicked`
- `dashboards_toolbar_actions_clicked`
- `dashboards_toolbar_add_clicked`
- `dashboards_version_restore_clicked`
- `grafana_alerting_*` (see Alerting Analytics above)
- `grafana_azure_cheatsheet_logs_query_selected`
- `grafana_banner_saved`
- `grafana_browse_dashboards_page_*` (see Browse Dashboard Events above)
- `grafana_cloud_monitoring_config_changed`
- `grafana_dashboard_created`
- `grafana_dashboard_import_finished`
- `grafana_dashboard_saved`
- `grafana_dashboards_public_enable_clicked`
- `grafana_datasource_drop_files`
- `grafana_ds_azuremonitor_subscriptions_loaded`
- `grafana_empty_state_shown`
- `grafana_explore_*` (see Explore Analytics above)
- `grafana_extension_sidebar_changed`
- `grafana_flamegraph_*` (see FlameGraph Analytics above)

#### H-P
- `grafana_loki_*` (see Loki Events above)
- `grafana_logs_download_clicked`
- `grafana_logs_download_logs_clicked`
- `grafana_manage_dashboards_delete_clicked`
- `grafana_manage_dashboards_item_deleted`
- `grafana_manage_dashboards_item_moved`
- `grafana_menu_item_clicked`
- `grafana_panel_inspect_*` (see Panel Inspector Events above)
- `grafana_prom_*` (see Explore Prometheus Events above)
- `grafana_query_builder_hints_clicked`
- `grafana_restore_clicked`
- `grafana_sql_*` (see SQL Events above)
- `grafana_traces_*` (see Trace Events above)
- `logs_log_line_details_*` (see Log Details Events above)
- `logs_log_list_controls_*` (see Log Controls Events above)
- `manage_dashboards_*` (see Search Events above)
- `plugins_sandbox_switch`

#### Q-Z
- `query_editor_row_hide_query_clicked`
- `query_library-*` (see Query Library Analytics above)
- `report_*` (see Report V2 Events above)
- `reports_draft_saved`
- `reports_preview_pdf`
- `reports_report_abandoned`
- `reports_report_submitted`
- `user_grafana_prometheus_editor_mode_clicked`

### Dynamic Event Names
Some events use dynamic naming patterns:
- `${eventTrackingNamespace}_viewed` (where namespace is 'manage_dashboards' or 'dashboard_search')
- `${eventTrackingNamespace}_result_clicked`
- `${eventTrackingNamespace}_query_submitted`
- `${eventTrackingNamespace}_query_failed`
- `dashboards_${name}` (where name comes from DashboardInteractions)
- `query_library-${event}` (where event comes from QueryLibraryInteractions)
- `report_${name}` (where name comes from ReportingInteractions)
- `grafana_flamegraph_${name}` (where name is context-specific)
- `grafana_panel_inspect_${PanelInspectType}_${name}_clicked`
