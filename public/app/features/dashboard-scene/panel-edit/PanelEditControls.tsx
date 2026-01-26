import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { InlineSwitch, useStyles2 } from '@grafana/ui';

import { PanelEditor } from './PanelEditor';

export interface Props {
  panelEditor: PanelEditor;
}

export function PanelEditControls({ panelEditor }: Props) {
  const { tableView, dataPane } = panelEditor.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {dataPane && (
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
    }),
  };
}
