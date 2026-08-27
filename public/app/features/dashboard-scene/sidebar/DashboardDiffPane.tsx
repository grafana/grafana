import { css } from '@emotion/css';

import { type DashboardDiffViewAction, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { Button, EmptyState, Sidebar, useStyles2 } from '@grafana/ui';
import { MonacoDiffEditor } from 'app/core/components/MonacoDiffEditor/MonacoDiffEditor';

export interface DashboardDiffPaneState extends SceneObjectState {
  /** Dashboard spec to diff against, as JSON text. */
  original: string;
  /** Dashboard spec to diff, as JSON text. */
  current: string;
  title?: string;
  /** Caller-owned action rendered under the diff. The pane only renders it and calls back. */
  action?: DashboardDiffViewAction;
}

export class DashboardDiffPane extends SceneObjectBase<DashboardDiffPaneState> {
  public static Component = DashboardDiffPaneRenderer;
  public minWidth = 700;

  public getId() {
    return 'diff' as const;
  }
}

function DashboardDiffPaneRenderer({ model }: SceneComponentProps<DashboardDiffPane>) {
  const styles = useStyles2(getStyles);
  const { original, current, title, action } = model.useState();

  const hasDiff = original !== current;

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={title ?? t('dashboard.sidebar.diff.pane-header', 'Changes')} />
      <div className={styles.content}>
        {hasDiff ? (
          <div className={styles.diffContainer}>
            <MonacoDiffEditor original={original} modified={current} language="json" height="100%" />
          </div>
        ) : (
          <EmptyState variant="completed" message={t('dashboard.sidebar.diff.no-changes', 'No changes to show')} />
        )}
        {action && (
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    height: '100%',
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(1),
    gap: theme.spacing(1),
  }),
  diffContainer: css({
    // No `height: 100%` alongside `flex: 1 1 0`: it makes the diff claim the whole content box and
    // pushes the action row below the fold.
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'auto',
  }),
  actions: css({
    display: 'flex',
    justifyContent: 'flex-end',
    flex: '0 0 auto',
  }),
});
