import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { InlineSwitch, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { type PanelEditor } from './PanelEditor';

export interface Props {
  panelEditor: PanelEditor;
}

export function PanelEditControls({ panelEditor }: Props) {
  const { tableView, dataPane, sqlPrototypeMode } = panelEditor.useState();
  const styles = useStyles2(getStyles);

  if (!dataPane && !config.featureToggles.sqlAbstractionPrototype) {
    return null;
  }

  const sqlModeOptions = [
    { label: 'Classic', value: 'classic' as const },
    { label: '{ } SQL', value: 'sql' as const },
  ];

  return (
    <div className={styles.container}>
      {config.featureToggles.sqlAbstractionPrototype && (
        <RadioButtonGroup
          options={sqlModeOptions}
          value={sqlPrototypeMode ?? 'classic'}
          onChange={panelEditor.onToggleSqlPrototypeMode}
          size="sm"
        />
      )}
      {dataPane && sqlPrototypeMode !== 'sql' && (
        <InlineSwitch
          label={t('dashboard-scene.panel-edit-controls.table-view-label-table-view', 'Table view')}
          showLabel={true}
          id="table-view"
          value={tableView ? true : false}
          onClick={panelEditor.onToggleTableView}
          aria-label={t(
            'dashboard-scene.panel-edit-controls.table-view-aria-label-toggletableview',
            'Toggle table view'
          )}
          data-testid={selectors.components.PanelEditor.toggleTableView}
        />
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      marginBottom: theme.spacing(1),
      marginRight: theme.spacing(1),
      gap: theme.spacing(1),
    }),
  };
}
