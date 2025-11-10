import { reportInteraction } from '@grafana/runtime';

const SCHEMA_VERSION = 1;

type ContentKind = 'datasource_dashboard' | 'community_dashboard' | 'template_dashboard';
// in future this could also include "template_dashboard" if/when items become templates
// | 'template_dashboard';

export type TemplateDashboardSourceEntryPoint =
  | 'quick_add_button'
  | 'command_palette'
  | 'dashboard_list_page_create_new_button';

type SourceEntryPoint = 'datasource_page' | TemplateDashboardSourceEntryPoint | 'unknown';
// possible future flows onboarding, create-dashboard, empty states
// | 'create_dashboard' | 'empty_state';

type EventLocation =
  | 'empty_dashboard'
  | 'suggested_dashboards_modal_provisioned_tab'
  | 'suggested_dashboards_modal_community_tab';

export const DashboardLibraryInteractions = {
  loaded: (properties: {
    numberOfItems: number;
    contentKinds: ContentKind[];
    datasourceTypes: string[];
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
  }) => {
    reportDashboardLibraryInteraction('loaded', properties);
  },
  itemClicked: (properties: {
    contentKind: ContentKind;
    datasourceTypes: string[];
    libraryItemId: string;
    libraryItemTitle: string;
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
  }) => {
    reportDashboardLibraryInteraction('item_clicked', properties);
  },
  entryPointClicked: (properties: { entryPoint: SourceEntryPoint }) => {
    reportDashboardLibraryInteraction('entry_point_clicked', properties);
  },
};

const reportDashboardLibraryInteraction = (name: string, properties?: Record<string, unknown>) => {
  reportInteraction(`grafana_dashboard_library_${name}`, { ...properties, schema_version: SCHEMA_VERSION });
};
