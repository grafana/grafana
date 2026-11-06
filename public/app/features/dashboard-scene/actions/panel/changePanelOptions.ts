import { isEqual } from 'lodash';

import { type FieldConfigSource } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { getLibraryPanelBehavior } from '../../utils/utils';
import { edit } from '../utils/edit';

function recordLibraryPanelSavedOptions(panel: VizPanel) {
  getLibraryPanelBehavior(panel)?.recordSavedOptions();
}

/**
 * Applies options without recording an edit, for live updates while typing. Record the edit once the
 * user is done with changePanelOptions, passing the options from before the first live update.
 */
export function previewPanelOptions(panel: VizPanel, options: object) {
  recordLibraryPanelSavedOptions(panel);
  panel.onOptionsChange(options, true);
}

/**
 * @param previousOptions what undo restores, when the change was already applied with previewPanelOptions
 */
export function changePanelOptions(
  panel: VizPanel,
  options: object,
  name: string,
  category: string,
  previousOptions: object = panel.state.options
) {
  const oldOptions = previousOptions;
  if (isEqual(oldOptions, options)) {
    return;
  }

  edit({
    source: panel,
    meta: { actionId: 'panel.changeOption', scope: 'options' },
    description: t('dashboard.edit-actions.panel-option', '{{category}}: {{name}}', { category, name }),
    perform: () => {
      recordLibraryPanelSavedOptions(panel);
      // Merged like in the panel editor, see getVisualizationOptions2
      panel.onOptionsChange(options);
    },
    undo: () => {
      recordLibraryPanelSavedOptions(panel);
      panel.onOptionsChange(oldOptions, true);
    },
  });
}

export function changePanelFieldConfig(
  panel: VizPanel,
  fieldConfig: FieldConfigSource,
  name: string,
  category: string
) {
  const oldFieldConfig = panel.state.fieldConfig;
  if (isEqual(oldFieldConfig, fieldConfig)) {
    return;
  }

  edit({
    source: panel,
    meta: { actionId: 'panel.changeOption', scope: 'field-config' },
    description: t('dashboard.edit-actions.panel-option', '{{category}}: {{name}}', { category, name }),
    perform: () => {
      recordLibraryPanelSavedOptions(panel);
      panel.onFieldConfigChange(fieldConfig, true);
    },
    undo: () => {
      recordLibraryPanelSavedOptions(panel);
      panel.onFieldConfigChange(oldFieldConfig, true);
    },
  });
}

export function discardLibraryPanelOptionChanges(panel: VizPanel) {
  const savedOptions = getLibraryPanelBehavior(panel)?.state._savedOptions;
  if (!savedOptions) {
    return;
  }

  const { options, fieldConfig } = panel.state;

  edit({
    source: panel,
    meta: { actionId: 'panel.discardLibraryPanelChanges' },
    description: t('dashboard.edit-actions.discard-library-panel-changes', 'Discard library panel changes'),
    perform: () => {
      panel.onOptionsChange(savedOptions.options, true);
      panel.onFieldConfigChange(savedOptions.fieldConfig, true);
    },
    undo: () => {
      recordLibraryPanelSavedOptions(panel);
      panel.onOptionsChange(options, true);
      panel.onFieldConfigChange(fieldConfig, true);
    },
  });
}
