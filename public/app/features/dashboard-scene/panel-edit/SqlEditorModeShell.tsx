import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { SqlEditorMode } from 'app/features/sql-prototype/editor/SqlEditorMode';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { type PanelEditor } from './PanelEditor';

export function SqlEditorModeShell({ model }: SceneComponentProps<PanelEditor>) {
  const dashboard = getDashboardSceneFor(model);
  const { controls } = dashboard.useState();
  const styles = useStyles2(getStyles);

  return (
    <>
      <NavToolbarActions dashboard={dashboard} />
      <div className={styles.body}>
        {controls && (
          <div className={styles.controls}>
            <controls.Component model={controls} />
          </div>
        )}
        <div className={styles.workbench}>
          <SqlEditorMode />
        </div>
      </div>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    body: css({
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }),
    controls: css({
      flexShrink: 0,
    }),
    workbench: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }),
  };
}
