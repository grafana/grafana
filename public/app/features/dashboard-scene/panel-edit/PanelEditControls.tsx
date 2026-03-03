import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, InlineSwitch, useStyles2 } from '@grafana/ui';

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
      {config.featureToggles.queryEditorNext && (
        <Button onClick={panelEditor.onToggleQueryEditorVersion} tooltip="" variant="secondary" icon="history">
          {useQueryExperienceNext
            ? t('dashboard-scene.panel-edit-controls.back-to-classic', 'Back to classic editor')
            : t('dashboard-scene.panel-edit-controls.try-new-editor', 'Try new editor')}
        </Button>
      )}
      <InlineSwitch
        label={t('dashboard-scene.panel-edit-controls.table-view-label-table-view', 'Table view')}
        showLabel={true}
        id="table-view"
        value={tableView ? true : false}
        onClick={panelEditor.onToggleTableView}
        aria-label={t('dashboard-scene.panel-edit-controls.table-view-aria-label-toggletableview', 'Toggle table view')}
        data-testid={selectors.components.PanelEditor.toggleTableView}
      />
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
