import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { useHasClonedParents } from '../../utils/clone';
import { useDashboardState } from '../../utils/utils';
import { CanvasGridAddActions } from '../layouts-shared/CanvasGridAddActions';
import { dashboardCanvasAddButtonHoverStyles } from '../layouts-shared/styles';

import { AutoGridLayout, AutoGridLayoutState } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

export function AutoGridLayoutRenderer({ model }: SceneComponentProps<AutoGridLayout>) {
  const { children, isHidden, isLazy } = model.useState();
  const hasClonedParents = useHasClonedParents(model);
  const styles = useStyles2(getStyles, model.state);
  const { layoutOrchestrator, isEditing } = useDashboardState(model);
  const layoutManager = sceneGraph.getAncestor(model, AutoGridLayoutManager);
  const { fillScreen } = layoutManager.useState();

  if (isHidden || !layoutOrchestrator) {
    return null;
  }

  const showCanvasActions = !hasClonedParents && isEditing;

  return (
    <div
      className={cx(styles.container, fillScreen && styles.containerFillScreen, isEditing && styles.containerEditing)}
      ref={model.containerRef}
    >
      {children.map((item) =>
        isLazy ? (
          <LazyLoader key={item.state.key!} className={styles.container}>
            <item.Component key={item.state.key} model={item} />
          </LazyLoader>
        ) : (
          <item.Component key={item.state.key} model={item} />
        )
      )}
      {showCanvasActions && <CanvasGridAddActions layoutManager={layoutManager} />}
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
    // Show add action when hovering over the grid
    ...dashboardCanvasAddButtonHoverStyles,
  }),
  containerFillScreen: css({
    flexGrow: 1,
  }),
  containerEditing: css({
    paddingBottom: theme.spacing(5),
    position: 'relative',
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
