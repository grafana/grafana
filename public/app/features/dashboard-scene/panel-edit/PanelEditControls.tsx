import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { InlineSwitch, useStyles2 } from '@grafana/ui';

import { PanelEditor } from './PanelEditor';

export interface Props {
  panelEditor: PanelEditor;
}

export function PanelEditControls({ panelEditor }: Props) {
  const { tableView, dataPane, useQueryExperienceNext } = panelEditor.useState();
  const styles = useStyles2(getStyles);

  if (!dataPane) {
    return null;
  }

  return (
    <div className={styles.container}>
      <InlineSwitch
        label={t('dashboard-scene.panel-edit-controls.table-view-label-table-view', 'Table view')}
        showLabel={true}
        id="table-view"
        value={tableView ? true : false}
        onClick={panelEditor.onToggleTableView}
        aria-label={t('dashboard-scene.panel-edit-controls.table-view-aria-label-toggletableview', 'Toggle table view')}
        data-testid={selectors.components.PanelEditor.toggleTableView}
      />
      {config.featureToggles.queryEditorNext && (
        <InlineSwitch
          label={t('dashboard-scene.panel-edit-controls.query-editor-version', 'Query editor v2')}
          showLabel={true}
          id="query-editor-version"
          value={useQueryExperienceNext ?? true}
          onClick={panelEditor.onToggleQueryEditorVersion}
          aria-label={t(
            'dashboard-scene.panel-edit-controls.query-editor-version-toggle',
            'Toggle between query editor v1 and v2'
          )}
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
