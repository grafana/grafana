# Analytics report

This report contains all the analytics events that are defined in the project.

## Events

### preferences

### 1: _grafana_preferences_save_button_clicked_

**Description**: Fired when the user clicks the Save button on the preferences form.

**Properties**:

| name           | type                        | description                                                                     |
| -------------- | --------------------------- | ------------------------------------------------------------------------------- |
| preferenceType | `"org" \| "team" \| "user"` | Whether the preference being saved belongs to an org, team, or individual user. |
| theme          | `undefined \| string`       | The theme value at the time of saving, if one is set.                           |
| language       | `undefined \| string`       | The language value at the time of saving, if one is set.                        |

### 2: _grafana_preferences_theme_changed_

**Description**: Fired immediately when the user selects a new theme from the theme picker, before saving.

**Properties**:

| name           | type                        | description                                                                       |
| -------------- | --------------------------- | --------------------------------------------------------------------------------- |
| preferenceType | `"org" \| "team" \| "user"` | Whether the preference being changed belongs to an org, team, or individual user. |
| toTheme        | `string`                    | The theme the user switched to.                                                   |

### 3: _grafana_preferences_language_changed_

**Description**: Fired immediately when the user selects a new language from the language picker, before saving.

**Properties**:

| name           | type                        | description                                                                       |
| -------------- | --------------------------- | --------------------------------------------------------------------------------- |
| preferenceType | `"org" \| "team" \| "user"` | Whether the preference being changed belongs to an org, team, or individual user. |
| toLanguage     | `string`                    | The language the user switched to.                                                |

### 4: _grafana_preferences_regional_format_changed_

**Description**: Fired immediately when the user selects a new regional format from the regional format picker, before saving.

**Properties**:

| name             | type                        | description                                                                       |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------- |
| preferenceType   | `"org" \| "team" \| "user"` | Whether the preference being changed belongs to an org, team, or individual user. |
| toRegionalFormat | `string`                    | The regional format the user switched to.                                         |

### dashboard_library

### 1: _grafana_dashboard_library_loaded_

**Description**: Fired when the library panel finishes rendering and its items are visible.

**Owner:** grafana-dashboards

**Properties**:

| name                        | type                                                                                                                                                                                                                                                                  | description                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| schema_version              | `number`                                                                                                                                                                                                                                                              |                                                                                  |
| numberOfItems               | `number`                                                                                                                                                                                                                                                              | Total number of items visible in the library at load time.                       |
| contentKinds                | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"[]`                                                                                                                                                                 | The categories of content (e.g. panels, dashboards) present in the loaded set.   |
| datasourceTypes             | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources referenced by the loaded items.                       |
| sourceEntryPoint            | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface or navigation path the user came from to reach the library.       |
| eventLocation               | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the event fired.               |
| isDashboardAssistantEnabled | `undefined \| false \| true`                                                                                                                                                                                                                                          | Whether the Dashboard Assistant AI feature was enabled at the time of the event. |

### 2: _grafana_dashboard_library_search_performed_

**Description**: Fired when the user submits or modifies a search query within the library.

**Owner:** grafana-dashboards

**Properties**:

| name             | type                                                                                                                                                                                                                                                                  | description                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| schema_version   | `number`                                                                                                                                                                                                                                                              |                                                                             |
| datasourceTypes  | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources used as search filters.                          |
| sourceEntryPoint | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.             |
| eventLocation    | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the search was performed. |
| hasResults       | `false \| true`                                                                                                                                                                                                                                                       | Whether the query returned at least one result.                             |
| resultCount      | `number`                                                                                                                                                                                                                                                              | Number of items matching the query.                                         |

### 3: _grafana_dashboard_library_item_clicked_

**Description**: Fired when the user selects an item from the library list.

**Owner:** grafana-dashboards

**Properties**:

| name                        | type                                                                                                                                                                                                                                                                  | description                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| schema_version              | `number`                                                                                                                                                                                                                                                              |                                                                                  |
| contentKind                 | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content the user clicked (e.g. panel, dashboard).                |
| datasourceTypes             | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources used by the clicked item.                             |
| libraryItemId               | `string`                                                                                                                                                                                                                                                              | Unique identifier of the library item.                                           |
| libraryItemTitle            | `string`                                                                                                                                                                                                                                                              | Display title of the library item as shown in the UI.                            |
| sourceEntryPoint            | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.                  |
| eventLocation               | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the click occurred.            |
| discoveryMethod             | `"search" \| "browse"`                                                                                                                                                                                                                                                | How the user found the item — e.g. via search, browsing, or a suggestion.        |
| isDashboardAssistantEnabled | `undefined \| false \| true`                                                                                                                                                                                                                                          | Whether the Dashboard Assistant AI feature was enabled at the time of the event. |

### 4: _grafana_dashboard_library_mapping_form_shown_

**Description**: Fired when the datasource mapping form is displayed during an import flow.

**Owner:** grafana-dashboards

**Properties**:

| name                  | type                                                                                                                                                                                                                                                                  | description                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| schema_version        | `number`                                                                                                                                                                                                                                                              |                                                                                                   |
| contentKind           | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content being imported.                                                           |
| datasourceTypes       | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources referenced by the item being imported.                                 |
| libraryItemId         | `string`                                                                                                                                                                                                                                                              | Unique identifier of the item being imported.                                                     |
| libraryItemTitle      | `string`                                                                                                                                                                                                                                                              | Display title of the item being imported.                                                         |
| sourceEntryPoint      | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.                                   |
| eventLocation         | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the form appeared.                              |
| unmappedDsInputsCount | `number`                                                                                                                                                                                                                                                              | Number of data source inputs that could not be resolved automatically and require manual mapping. |
| constantInputsCount   | `number`                                                                                                                                                                                                                                                              | Number of constant/template-variable inputs present in the item.                                  |

### 5: _grafana_dashboard_library_mapping_form_completed_

**Description**: Fired when the user submits the datasource mapping form to complete an import.

**Owner:** grafana-dashboards

**Properties**:

| name             | type                                                                                                                                                                                                                                                                  | description                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| schema_version   | `number`                                                                                                                                                                                                                                                              |                                                                           |
| contentKind      | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content being imported.                                   |
| datasourceTypes  | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources referenced by the item.                        |
| libraryItemId    | `string`                                                                                                                                                                                                                                                              | Unique identifier of the item being imported.                             |
| libraryItemTitle | `string`                                                                                                                                                                                                                                                              | Display title of the item being imported.                                 |
| sourceEntryPoint | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.           |
| eventLocation    | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the form was completed. |
| userMappedCount  | `number`                                                                                                                                                                                                                                                              | Number of data sources the user mapped manually.                          |
| autoMappedCount  | `number`                                                                                                                                                                                                                                                              | Number of data sources resolved automatically without user input.         |

### 6: _grafana_dashboard_library_entry_point_clicked_

**Description**: Fired when the user clicks a UI entry point to open the library.

**Owner:** grafana-dashboards

**Properties**:

| name           | type                                                                                                                                                                                                                                                                  | description                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| schema_version | `number`                                                                                                                                                                                                                                                              |                                                                         |
| entryPoint     | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The specific entry point (button, link, etc.) the user interacted with. |
| contentKind    | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content accessible through this entry point.            |

### 7: _grafana_dashboard_library_compatibility_check_triggered_

**Description**: Fired when a dashboard compatibility check is initiated, either manually or on initial load.

**Owner:** grafana-dashboards

**Properties**:

| name           | type                                                                                                       | description                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| schema_version | `number`                                                                                                   |                                                                            |
| dashboardId    | `string`                                                                                                   | Unique identifier of the dashboard being checked.                          |
| dashboardTitle | `string`                                                                                                   | Display title of the dashboard being checked.                              |
| datasourceType | `string`                                                                                                   | Plugin ID of the data source being evaluated for compatibility.            |
| triggerMethod  | `"manual" \| "auto_initial_load"`                                                                          | Whether the check was started by the user or automatically on page load.   |
| eventLocation  | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"` | The specific UI location within the product where the check was triggered. |

### 8: _grafana_dashboard_library_compatibility_check_completed_

**Description**: Fired when a dashboard compatibility check finishes and results are ready for display.

**Owner:** grafana-dashboards

**Properties**:

| name           | type                                                                                                       | description                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| schema_version | `number`                                                                                                   |                                                                                           |
| dashboardId    | `string`                                                                                                   | Unique identifier of the dashboard that was checked.                                      |
| dashboardTitle | `string`                                                                                                   | Display title of the dashboard that was checked.                                          |
| datasourceType | `string`                                                                                                   | Plugin ID of the data source that was evaluated.                                          |
| score          | `number`                                                                                                   | Compatibility score (0–100) indicating how well the dashboard works with the data source. |
| metricsFound   | `number`                                                                                                   | Number of metrics from the dashboard that were found in the data source.                  |
| metricsTotal   | `number`                                                                                                   | Total number of metrics in the dashboard that were checked.                               |
| triggerMethod  | `"manual" \| "auto_initial_load"`                                                                          | Whether the check was started by the user or automatically on page load.                  |
| eventLocation  | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"` | The specific UI location within the product where the check was completed.                |

### 9: _grafana_dashboard_library_loaded_

**Description**: Fired when the Template Dashboards view finishes loading.

**Owner:** grafana-dashboards

**Properties**:

| name                        | type                                                                                                                                                                                                                                                                  | description                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| schema_version              | `number`                                                                                                                                                                                                                                                              |                                                                                  |
| numberOfItems               | `number`                                                                                                                                                                                                                                                              | Total number of items visible in the library at load time.                       |
| contentKinds                | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"[]`                                                                                                                                                                 | The categories of content (e.g. panels, dashboards) present in the loaded set.   |
| datasourceTypes             | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources referenced by the loaded items.                       |
| sourceEntryPoint            | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface or navigation path the user came from to reach the library.       |
| eventLocation               | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the event fired.               |
| isDashboardAssistantEnabled | `undefined \| false \| true`                                                                                                                                                                                                                                          | Whether the Dashboard Assistant AI feature was enabled at the time of the event. |

### 10: _grafana_dashboard_library_search_performed_

**Description**: Fired when the user submits or modifies a search query within the library.

**Owner:** grafana-dashboards

**Properties**:

| name             | type                                                                                                                                                                                                                                                                  | description                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| schema_version   | `number`                                                                                                                                                                                                                                                              |                                                                             |
| datasourceTypes  | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources used as search filters.                          |
| sourceEntryPoint | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.             |
| eventLocation    | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the search was performed. |
| hasResults       | `false \| true`                                                                                                                                                                                                                                                       | Whether the query returned at least one result.                             |
| resultCount      | `number`                                                                                                                                                                                                                                                              | Number of items matching the query.                                         |

### 11: _grafana_dashboard_library_item_clicked_

**Description**: Fired when the user selects an item in the Template Dashboards view.

**Owner:** grafana-dashboards

**Properties**:

| name                        | type                                                                                                                                                                                                                                                                  | description                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| schema_version              | `number`                                                                                                                                                                                                                                                              |                                                                                  |
| contentKind                 | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content the user clicked (e.g. panel, dashboard).                |
| datasourceTypes             | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources used by the clicked item.                             |
| libraryItemId               | `string`                                                                                                                                                                                                                                                              | Unique identifier of the library item.                                           |
| libraryItemTitle            | `string`                                                                                                                                                                                                                                                              | Display title of the library item as shown in the UI.                            |
| sourceEntryPoint            | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.                  |
| eventLocation               | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the click occurred.            |
| discoveryMethod             | `"search" \| "browse"`                                                                                                                                                                                                                                                | How the user found the item — e.g. via search, browsing, or a suggestion.        |
| isDashboardAssistantEnabled | `undefined \| false \| true`                                                                                                                                                                                                                                          | Whether the Dashboard Assistant AI feature was enabled at the time of the event. |

### 12: _grafana_dashboard_library_mapping_form_shown_

**Description**: Fired when the datasource mapping form is displayed during an import flow.

**Owner:** grafana-dashboards

**Properties**:

| name                  | type                                                                                                                                                                                                                                                                  | description                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| schema_version        | `number`                                                                                                                                                                                                                                                              |                                                                                                   |
| contentKind           | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content being imported.                                                           |
| datasourceTypes       | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources referenced by the item being imported.                                 |
| libraryItemId         | `string`                                                                                                                                                                                                                                                              | Unique identifier of the item being imported.                                                     |
| libraryItemTitle      | `string`                                                                                                                                                                                                                                                              | Display title of the item being imported.                                                         |
| sourceEntryPoint      | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.                                   |
| eventLocation         | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the form appeared.                              |
| unmappedDsInputsCount | `number`                                                                                                                                                                                                                                                              | Number of data source inputs that could not be resolved automatically and require manual mapping. |
| constantInputsCount   | `number`                                                                                                                                                                                                                                                              | Number of constant/template-variable inputs present in the item.                                  |

### 13: _grafana_dashboard_library_mapping_form_completed_

**Description**: Fired when the user submits the datasource mapping form to complete an import.

**Owner:** grafana-dashboards

**Properties**:

| name             | type                                                                                                                                                                                                                                                                  | description                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| schema_version   | `number`                                                                                                                                                                                                                                                              |                                                                           |
| contentKind      | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content being imported.                                   |
| datasourceTypes  | `string[]`                                                                                                                                                                                                                                                            | Plugin IDs of data sources referenced by the item.                        |
| libraryItemId    | `string`                                                                                                                                                                                                                                                              | Unique identifier of the item being imported.                             |
| libraryItemTitle | `string`                                                                                                                                                                                                                                                              | Display title of the item being imported.                                 |
| sourceEntryPoint | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The UI surface the user came from when they opened the library.           |
| eventLocation    | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"`                                                                                                                                                            | The specific UI location within the product where the form was completed. |
| userMappedCount  | `number`                                                                                                                                                                                                                                                              | Number of data sources the user mapped manually.                          |
| autoMappedCount  | `number`                                                                                                                                                                                                                                                              | Number of data sources resolved automatically without user input.         |

### 14: _grafana_dashboard_library_entry_point_clicked_

**Description**: Fired when the user clicks a UI entry point to open the library.

**Owner:** grafana-dashboards

**Properties**:

| name           | type                                                                                                                                                                                                                                                                  | description                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| schema_version | `number`                                                                                                                                                                                                                                                              |                                                                         |
| entryPoint     | `"datasource_page_build_button" \| "datasource_page_success_banner" \| "datasource_list_build_button" \| "dashboard_page_suggested_dashboards_banner" \| "quick_add_button" \| "command_palette" \| "browse_dashboards_page_create_new_button" \| "assistant_button"` | The specific entry point (button, link, etc.) the user interacted with. |
| contentKind    | `"datasource_dashboard" \| "community_dashboard" \| "template_dashboard" \| "suggested_dashboards"`                                                                                                                                                                   | The category of content accessible through this entry point.            |

### 15: _grafana_dashboard_library_compatibility_check_triggered_

**Description**: Fired when a dashboard compatibility check is initiated, either manually or on initial load.

**Owner:** grafana-dashboards

**Properties**:

| name           | type                                                                                                       | description                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| schema_version | `number`                                                                                                   |                                                                            |
| dashboardId    | `string`                                                                                                   | Unique identifier of the dashboard being checked.                          |
| dashboardTitle | `string`                                                                                                   | Display title of the dashboard being checked.                              |
| datasourceType | `string`                                                                                                   | Plugin ID of the data source being evaluated for compatibility.            |
| triggerMethod  | `"manual" \| "auto_initial_load"`                                                                          | Whether the check was started by the user or automatically on page load.   |
| eventLocation  | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"` | The specific UI location within the product where the check was triggered. |

### 16: _grafana_dashboard_library_compatibility_check_completed_

**Description**: Fired when a dashboard compatibility check finishes and results are ready for display.

**Owner:** grafana-dashboards

**Properties**:

| name           | type                                                                                                       | description                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| schema_version | `number`                                                                                                   |                                                                                           |
| dashboardId    | `string`                                                                                                   | Unique identifier of the dashboard that was checked.                                      |
| dashboardTitle | `string`                                                                                                   | Display title of the dashboard that was checked.                                          |
| datasourceType | `string`                                                                                                   | Plugin ID of the data source that was evaluated.                                          |
| score          | `number`                                                                                                   | Compatibility score (0–100) indicating how well the dashboard works with the data source. |
| metricsFound   | `number`                                                                                                   | Number of metrics from the dashboard that were found in the data source.                  |
| metricsTotal   | `number`                                                                                                   | Total number of metrics in the dashboard that were checked.                               |
| triggerMethod  | `"manual" \| "auto_initial_load"`                                                                          | Whether the check was started by the user or automatically on page load.                  |
| eventLocation  | `"dashboard_page_suggested_dashboards_banner" \| "suggested_dashboards_modal" \| "browse_dashboards_page"` | The specific UI location within the product where the check was completed.                |
