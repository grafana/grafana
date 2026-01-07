import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { useDashboardState } from '../../utils/utils';
import { useSoloPanelContext } from '../SoloPanelContext';
import { CanvasGridAddActions } from '../layouts-shared/CanvasGridAddActions';
import { dashboardCanvasAddButtonHoverStyles } from '../layouts-shared/styles';

import { AutoGridLayout, AutoGridLayoutState } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

export function AutoGridLayoutRenderer({ model }: SceneComponentProps<AutoGridLayout>) {
  const { children, isHidden } = model.useState();
  const styles = useStyles2(getStyles, model.state);
  const { layoutOrchestrator, isEditing } = useDashboardState(model);
  const layoutManager = sceneGraph.getAncestor(model, AutoGridLayoutManager);
  const { fillScreen, dropPosition } = layoutManager.useState();
  const soloPanelContext = useSoloPanelContext();

  if (isHidden || !layoutOrchestrator) {
    return null;
  }

  const showCanvasActions = !isRepeatCloneOrChildOf(model) && isEditing;

  if (soloPanelContext) {
    return children.map((item) => <item.Component key={item.state.key} model={item} />);
  }

  // Build children with placeholder inserted at dropPosition
  const renderChildren = () => {
    if (dropPosition === null || dropPosition === undefined) {
      return children.map((item) => <item.Component key={item.state.key} model={item} />);
    }

    const result: React.ReactNode[] = [];
    const insertPosition = Math.min(dropPosition, children.length);

    for (let i = 0; i <= children.length; i++) {
      if (i === insertPosition) {
        result.push(<DropPlaceholder key="drop-placeholder" styles={styles} />);
      }
      if (i < children.length) {
        const item = children[i];
        result.push(<item.Component key={item.state.key} model={item} />);
      }
    }

    return result;
  };

  return (
    <div
      className={cx(styles.container, fillScreen && styles.containerFillScreen, isEditing && styles.containerEditing)}
      ref={model.containerRef}
      data-dashboard-drop-target-key={layoutManager.state.key}
    >
      {renderChildren()}
      {showCanvasActions && <CanvasGridAddActions layoutManager={layoutManager} />}
    </div>
  );
}

function DropPlaceholder({ styles }: { styles: ReturnType<typeof getStyles> }) {
  return <div className={styles.dropPlaceholder} />;
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
  containerFillScreen: css({ flexGrow: 1 }),
  containerEditing: css({ paddingBottom: theme.spacing(5), position: 'relative' }),
  dropPlaceholder: css({
    border: `1px dashed ${theme.colors.primary.main}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.primary.transparent,
    minHeight: state.autoRows || '320px',
  }),
});
