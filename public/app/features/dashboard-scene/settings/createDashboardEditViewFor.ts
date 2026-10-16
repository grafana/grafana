import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { AnnotationsEditView } from './AnnotationsEditView';
import { DashboardLinksEditView } from './DashboardLinksEditView';
import { DashboardTemplateEditView } from './DashboardTemplateEditView';
import { GeneralSettingsEditView } from './GeneralSettingsEditView';
import { JsonModelEditView } from './JsonModelEditView';
import { PermissionsEditView } from './PermissionsEditView';
import { VariablesEditView } from './VariablesEditView';
import { VersionsEditView } from './VersionsEditView';

export function createDashboardEditViewFor(editview: string) {
  switch (editview) {
    case 'annotations':
      return new AnnotationsEditView({});
    case 'variables':
      return new VariablesEditView({});
    case 'links':
      return new DashboardLinksEditView({});
    case 'versions':
      return new VersionsEditView({});
    case 'json-model':
      return new JsonModelEditView({});
    case 'permissions':
      return new PermissionsEditView({});
    case 'template':
      if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaCustomDashboardTemplates, false)) {
        return new DashboardTemplateEditView({});
      }
      return new GeneralSettingsEditView({});
    case 'settings':
    default:
      return new GeneralSettingsEditView({});
  }
}
