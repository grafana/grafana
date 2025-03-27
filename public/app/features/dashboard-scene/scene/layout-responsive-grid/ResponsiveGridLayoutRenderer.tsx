import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { AutoGridLayout, AutoGridLayoutState } from './ResponsiveGridLayout';

export function AutoGridLayoutRenderer({ model }: SceneComponentProps<AutoGridLayout>) {
  const { children, isHidden, isLazy } = model.useState();
  const styles = useStyles2(getStyles, model.state);
  const { layoutOrchestrator } = getDashboardSceneFor(model).state;

  if (isHidden || !layoutOrchestrator) {
    return null;
  }

  return (
    <div className={styles.container} ref={(ref) => model.setRef(ref)}>
      {children.map((item) =>
        isLazy ? (
          <LazyLoader key={item.state.key!} className={styles.container}>
            <item.Component key={item.state.key} model={item} />
          </LazyLoader>
        ) : (
          <item.Component key={item.state.key} model={item} />
        )
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, state: AutoGridLayoutState) => ({
  container: css({
    display: 'grid',
    position: 'relative',
    gridTemplateColumns: state.templateColumns,
    gridTemplateRows: state.templateRows || 'unset',
    gridAutoRows: state.autoRows || 'unset',
    rowGap: theme.spacing(state.rowGap ?? 1),
    columnGap: theme.spacing(state.columnGap ?? 1),
    justifyItems: state.justifyItems || 'unset',
    alignItems: state.alignItems || 'unset',
    justifyContent: state.justifyContent || 'unset',
    flexGrow: 1,

    [theme.breakpoints.down('md')]: state.md
      ? {
          gridTemplateRows: state.md.templateRows,
          gridTemplateColumns: state.md.templateColumns,
          rowGap: state.md.rowGap ? theme.spacing(state.md.rowGap ?? 1) : undefined,
          columnGap: state.md.columnGap ? theme.spacing(state.md.rowGap ?? 1) : undefined,
          justifyItems: state.md.justifyItems,
          alignItems: state.md.alignItems,
          justifyContent: state.md.justifyContent,
        }
      : undefined,
  }),
  wrapper: css({
    display: 'grid',
    position: 'relative',
    width: '100%',
    height: '100%',
  }),
  dragging: css({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.portal + 1,
    pointerEvents: 'none',
  }),
});
