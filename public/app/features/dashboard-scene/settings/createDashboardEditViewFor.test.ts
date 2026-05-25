import { AnnotationsEditView } from './AnnotationsEditView';
import { DashboardLinksEditView } from './DashboardLinksEditView';
import { DashboardTemplateEditView } from './DashboardTemplateEditView';
import { GeneralSettingsEditView } from './GeneralSettingsEditView';
import { JsonModelEditView } from './JsonModelEditView';
import { PermissionsEditView } from './PermissionsEditView';
import { VariablesEditView } from './VariablesEditView';
import { VersionsEditView } from './VersionsEditView';
import { createDashboardEditViewFor } from './createDashboardEditViewFor';

describe('createDashboardEditViewFor', () => {
  it.each([
    ['annotations', AnnotationsEditView],
    ['variables', VariablesEditView],
    ['links', DashboardLinksEditView],
    ['versions', VersionsEditView],
    ['json-model', JsonModelEditView],
    ['permissions', PermissionsEditView],
    ['template', DashboardTemplateEditView],
    ['settings', GeneralSettingsEditView],
  ])('returns the matching view for editview=%s', (editview, ExpectedClass) => {
    expect(createDashboardEditViewFor(editview)).toBeInstanceOf(ExpectedClass);
  });

  it('defaults to GeneralSettingsEditView for unknown editview values', () => {
    expect(createDashboardEditViewFor('unknown-value')).toBeInstanceOf(GeneralSettingsEditView);
    expect(createDashboardEditViewFor('')).toBeInstanceOf(GeneralSettingsEditView);
  });
});
