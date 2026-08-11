import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { InlineSwitch, Text, useStyles2 } from '@grafana/ui';
import { type DashboardControls } from 'app/features/dashboard-scene/scene/DashboardControls';

import { useNotebookEditMode } from './NotebookEditModeContext';

/**
 * The row above the notebook document: the view/edit toggle, and the shared time range.
 *
 * The row itself always renders, even when the notebook hides its time controls — the toggle must
 * not inherit the pickers' visibility.
 */
export function NotebookControls({ controls }: { controls?: DashboardControls }) {
  const styles = useStyles2(getStyles);
  const { isEditing, setIsEditing, canEdit } = useNotebookEditMode();

  return (
    <div className={styles.controls}>
      {isEditing && (
        // Pushed to the far left of the row; everything else stays right-aligned.
        <span className={styles.mode}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="notebooks.view.editing">Editing</Trans>
          </Text>
        </span>
      )}
      {canEdit && (
        <InlineSwitch
          id="notebook-edit-mode"
          label={t('notebooks.view.edit-mode', 'Edit')}
          showLabel
          value={isEditing}
          onChange={(event) => setIsEditing(event.currentTarget.checked)}
        />
      )}
      {controls && <NotebookTimeControls controls={controls} />}
    </div>
  );
}

// Split out so that controls.useState() stays unconditional — the pickers are optional, hooks aren't.
function NotebookTimeControls({ controls }: { controls: DashboardControls }) {
  const { timePicker, refreshPicker, hideTimeControls } = controls.useState();

  if (hideTimeControls) {
    return null;
  }

  return (
    <>
      <timePicker.Component model={timePicker} />
      <refreshPicker.Component model={refreshPicker} />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  controls: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
  }),
  mode: css({
    marginRight: 'auto',
  }),
});
