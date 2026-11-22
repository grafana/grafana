import { isEqual } from 'lodash';

import { type FieldConfigSource } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { getDashboardSceneLike } from '../../scene/types/dashboard';
import { edit } from '../utils/edit';

export function changeViewPanelOptions(
  panel: VizPanel,
  options: Record<string, unknown>,
  name: string,
  category: string
) {
  const oldOptions = panel.state.options;
  const perform = () => panel.onOptionsChange(options);

  // The View pane is also available outside edit mode, where changes must not enter edit history.
  if (!getDashboardSceneLike(panel).state.isEditing || isEqual(oldOptions, options)) {
    perform();
    return;
  }

  edit({
    source: panel,
    meta: { actionId: 'panel.changeQuickToggle', scope: 'options' },
    description: t('dashboard.edit-actions.view-panel-option', '{{category}}: {{name}}', { category, name }),
    perform,
    undo: () => panel.onOptionsChange(oldOptions, true),
  });
}

export function changeViewPanelFieldConfig(
  panel: VizPanel,
  fieldConfig: FieldConfigSource,
  name: string,
  category: string
) {
  const oldFieldConfig = panel.state.fieldConfig;
  const perform = () => panel.onFieldConfigChange(fieldConfig, true);

  // The View pane is also available outside edit mode, where changes must not enter edit history.
  if (!getDashboardSceneLike(panel).state.isEditing || isEqual(oldFieldConfig, fieldConfig)) {
    perform();
    return;
  }

  edit({
    source: panel,
    meta: { actionId: 'panel.changeQuickToggle', scope: 'field-config' },
    description: t('dashboard.edit-actions.view-panel-option', '{{category}}: {{name}}', { category, name }),
    perform,
    undo: () => panel.onFieldConfigChange(oldFieldConfig, true),
  });
}
