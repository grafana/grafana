import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useFlagGrafanaDashboardsAutoHeightPanels } from '@grafana/runtime/internal';
import { type SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { isFullDashboardEditing } from 'app/features/dashboard-scene/scene/types/dashboard';

import { useSoloPanelContext } from '../../solo/SoloPanelContext';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { getTestIdForLayout } from '../../utils/test-utils';
import { useDashboardState } from '../../utils/utils';
import { CanvasGridAddActions } from '../layouts-shared/CanvasGridAddActions';
import { dashboardCanvasAddButtonHoverStyles } from '../layouts-shared/styles';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../types/DashboardDropTarget';

import { type AutoGridLayout, type AutoGridLayoutState } from './AutoGridLayout';
import { type AutoGridColumnLayout, AutoGridLayoutManager } from './AutoGridLayoutManager';
import { AUTO_GRID_HIDDEN_ITEM_CLASS, AUTO_GRID_ITEM_ATTR } from './const';

export function AutoGridLayoutRenderer({ model }: SceneComponentProps<AutoGridLayout>) {
  const { children, isHidden, draggedChildren } = model.useState();
  const styles = useStyles2(getStyles, model.state);
  const dashboardState = useDashboardState(model);
  const {
    layoutOrchestrator,

    meta: { isEmbedded },
  } = dashboardState;
  const isEditing = isFullDashboardEditing(dashboardState);
  const layoutManager = sceneGraph.getAncestor(model, AutoGridLayoutManager);
  const { fillScreen, matchRowHeights, dropPosition, columnLayout } = layoutManager.useState();
  // Activity follows the saved items, so a drag preview never flips the arrangement.
  const split = columnLayout ? layoutManager.getColumnSplit(children) : undefined;
  const splitStyles = useStyles2(getSplitStyles);
  const soloPanelContext = useSoloPanelContext();
  const autoHeightPanelsEnabled = useFlagGrafanaDashboardsAutoHeightPanels();
  // Off => align items to the top so a tall fit panel doesn't stretch its row siblings.
  const noStretchSiblings = autoHeightPanelsEnabled && matchRowHeights === false;

  if (isHidden || !layoutOrchestrator) {
    return null;
  }

  const showCanvasActions = !isEmbedded && !isRepeatCloneOrChildOf(model) && isEditing;

  if (soloPanelContext) {
    return children.map((item) => <item.Component key={item.state.key} model={item} />);
  }

  const displayChildren = draggedChildren ?? children;

  // Build children with placeholder inserted at dropPosition
  const renderChildren = () => {
    if (dropPosition === null || dropPosition === undefined) {
      return displayChildren.map((item) => <item.Component key={item.state.key} model={item} />);
    }

    const result: React.ReactNode[] = [];
    const insertPosition = Math.min(dropPosition, displayChildren.length);

    for (let i = 0; i <= displayChildren.length; i++) {
      if (i === insertPosition) {
        result.push(<DropPlaceholder key="drop-placeholder" styles={styles} />);
      }
      if (i < displayChildren.length) {
        const item = displayChildren[i];
        result.push(<item.Component key={item.state.key} model={item} />);
      }
    }

    return result;
  };

  const itemCount = children.length;
  const noteColumns = Math.min(Math.max(itemCount - 1, 1), 3);
  const arrangementVars = split?.isActive
    ? {
        '--auto-grid-rail-span': String(Math.max(itemCount - 1, 1)),
        '--auto-grid-note-columns': String(noteColumns),
        '--auto-grid-note-span': String(Math.ceil((itemCount - 1) / noteColumns)),
        '--auto-grid-note-fr': `${(noteColumns / 3).toFixed(3)}fr`,
      }
    : undefined;

  const grid = (
    <div
      data-testid={selectors.components.LayoutContainer(getTestIdForLayout(model))}
      className={cx(
        styles.container,
        split?.isActive && splitStyles.split,
        split?.isActive && split.columnLayout && splitStyles[split.columnLayout],
        fillScreen && styles.containerFillScreen,
        noStretchSiblings && styles.containerNoStretch,
        isEditing && styles.containerEditing
      )}
      // Custom properties are not in CSSProperties.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      style={arrangementVars as React.CSSProperties}
      ref={model.containerRef}
      {...{ [DASHBOARD_DROP_TARGET_KEY_ATTR]: layoutManager.state.key }}
    >
      {renderChildren()}
      {showCanvasActions && <CanvasGridAddActions layoutManager={layoutManager} />}
    </div>
  );

  if (!split?.isActive) {
    return grid;
  }

  // Arrangements react to the section's width, not the window's, so a docked sidebar or a
  // nested row stacks the items as soon as the section itself gets narrow.
  return <div className={cx(splitStyles.container, fillScreen && splitStyles.containerFillScreen)}>{grid}</div>;
}

/** Positional selectors count only grid items; the edit-mode add actions share the grid. */
const ITEM = `[${AUTO_GRID_ITEM_ATTR}]`;
const FIRST = `& > :nth-child(1 of ${ITEM})`;
const LAST = `& > :nth-last-child(1 of ${ITEM})`;
const SECOND = `& > :nth-child(2 of ${ITEM})`;
const AFTER_FIRST = `& > ${ITEM}:not(:nth-child(1 of ${ITEM}))`;

/** A hairline between columns when the dashboard style asks for one. */
const columnRule = {
  borderLeft: 'var(--dash-column-rule, none)',
  paddingLeft: 'var(--dash-column-rule-pad, 0px)',
};

const getSplitStyles = (theme: GrafanaTheme2) => {
  // Theme-owned threshold: below this section width the items stack in document order.
  const columns = `@container (min-width: ${theme.breakpoints.values.md}px)`;
  return {
    container: css({
      containerType: 'inline-size',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }),
    containerFillScreen: css({ flexGrow: 1 }),
    split: css({
      gridTemplateColumns: 'minmax(0, 1fr)',
      // One visible item takes the full width instead of leaving an empty column.
      [`& > :only-child, & > .${AUTO_GRID_HIDDEN_ITEM_CLASS} + *, & > :has(+ .${AUTO_GRID_HIDDEN_ITEM_CLASS})`]: {
        gridColumn: '1 / -1',
      },
    }),
    'split-wide-first': css({
      [columns]: { gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', [SECOND]: columnRule },
    }),
    'split-wide-second': css({
      [columns]: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', [SECOND]: columnRule },
    }),
    // The lead item spans the height of the stacked rail beside it. Stacked, it keeps two rows so
    // a graphic sized for the rail's short rows still has room to plot.
    rail: css({
      [FIRST]: { gridRow: 'span 2' },
      [columns]: {
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gridAutoFlow: 'row dense',
        [FIRST]: { gridColumn: 1, gridRow: '1 / span var(--auto-grid-rail-span)' },
        [AFTER_FIRST]: { gridColumn: 2, ...columnRule },
      },
    }),
    // The last item is a narrow note that runs beside every row of the others.
    'margin-note': css({
      [columns]: {
        gridTemplateColumns:
          'repeat(var(--auto-grid-note-columns), minmax(0, 1fr)) minmax(12rem, var(--auto-grid-note-fr))',
        [LAST]: { gridColumn: '-2 / -1', gridRow: '1 / span var(--auto-grid-note-span)', ...columnRule },
      },
    }),
  } satisfies Record<'container' | 'containerFillScreen' | 'split' | AutoGridColumnLayout, string>;
};

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
  containerNoStretch: css({ alignItems: 'start' }),
  containerEditing: css({ paddingBottom: theme.spacing(5), position: 'relative' }),
  dropPlaceholder: css({
    border: `1px dashed ${theme.colors.primary.main}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.primary.transparent,
    minHeight: '100px',
  }),
});
