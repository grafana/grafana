import { css, cx } from '@emotion/css';
import { memo, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useFlagGrafanaDashboardsAutoHeightPanels } from '@grafana/runtime/internal';
import { LazyLoader, sceneGraph, type SceneComponentProps, VizPanelFitScope, type VizPanel } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';
import { isFullDashboardEditing } from 'app/features/dashboard-scene/scene/types/dashboard';

import { type ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { useIsConditionallyHidden } from '../../conditional-rendering/hooks/useIsConditionallyHidden';
import { useSoloPanelContext, renderMatchingSoloPanels } from '../../solo/SoloPanelContext';
import { useDashboardState } from '../../utils/utils';
import { SoloPanelContextValueWithSearchStringFilter } from '../PanelSearchLayout';
import { PanelEditActionsWrapper } from '../edit-actions-popover/PanelEditActions';
import { isUnifiedDragAndDropEnabled } from '../layouts-shared/unifiedDragAndDrop';
import { getIsLazy } from '../layouts-shared/utils';
import { AUTO_GRID_ITEM_DROP_TARGET_ATTR } from '../types/DashboardDropTarget';

import { type AutoGridItem } from './AutoGridItem';
import {
  AutoGridLayoutManager,
  getFitMinHeightInPixels,
  getMaxHeightInPixels,
  getNamedHeightInPixels,
} from './AutoGridLayoutManager';
import { AutoGridResizeIntercept } from './AutoGridResizeIntercept';
import { DRAGGED_ITEM_HEIGHT, DRAGGED_ITEM_LEFT, DRAGGED_ITEM_TOP, DRAGGED_ITEM_WIDTH } from './const';

export function AutoGridItemRenderer({ model }: SceneComponentProps<AutoGridItem>) {
  const { body, repeatedPanels = [], key, fitContent: itemFitContent } = model.useState();
  const { draggingKey, isDraggedItemOutside } = model.getParentGrid().useState();
  const dashboardState = useDashboardState(model);
  const { preload } = dashboardState;
  const isEditing = isFullDashboardEditing(dashboardState);
  const styles = useStyles2(getStyles);
  const soloPanelContext = useSoloPanelContext();
  const isLazy = useMemo(() => getIsLazy(preload), [preload]);

  const layoutManager = sceneGraph.getAncestor(model, AutoGridLayoutManager);
  const {
    isDropTarget,
    fitContent: layoutFitContent,
    rowHeight,
    minHeight,
    maxHeightMode,
    maxHeight,
    matchRowHeights,
  } = layoutManager.useState();

  // Subscribe so we re-render once the plugin loads and its capability is known.
  body.useState();

  const autoHeightPanelsEnabled = useFlagGrafanaDashboardsAutoHeightPanels();

  // Content-fit only applies to panels whose plugin supports it. A per-panel
  // override (opt-in/opt-out) wins over the layout default.
  const pluginSupportsFit = body.getPlugin()?.supportsFitContent === true;
  const fitContentOn = autoHeightPanelsEnabled && pluginSupportsFit && (itemFitContent ?? layoutFitContent) === true;
  const matchRowHeightsOn = !autoHeightPanelsEnabled || matchRowHeights !== false;
  const rowHeightPx = getNamedHeightInPixels(rowHeight);
  const fitMinHeightPx = getFitMinHeightInPixels(minHeight, rowHeight);

  // Fit-content sizing is pure CSS: the browser sizes the row to content. The
  // min-height floor is applied to the panel chrome (via the fit context) so
  // the chrome itself fills it — a min-height on this cell would leave the
  // chrome floating at the top.
  // Non-fit panels keep the row height as their floor. When row heights aren't
  // matched they pin to it explicitly so a tall fit sibling doesn't stretch them.
  // When a max height bounds the cell, the panel chrome applies the cap (via the
  // fit context) and hands the panel the inner height left, so panels that can
  // size to it do. Those that can't scroll inside the chrome's content area — not
  // this cell — so the panel header stays fixed (see styles.itemMaxHeightScroll).
  const fitMaxHeightPx = fitContentOn ? getMaxHeightInPixels(maxHeightMode, maxHeight) : undefined;
  const isMaxHeightBounded = fitMaxHeightPx !== undefined;
  const itemStyle = fitContentOn
    ? undefined
    : matchRowHeightsOn
      ? autoHeightPanelsEnabled
        ? { minHeight: rowHeightPx }
        : undefined
      : { height: rowHeightPx };

  const Wrapper = useMemo(
    () =>
      // eslint-disable-next-line react/display-name
      memo(
        ({
          item,
          conditionalRendering,
          addDndContainer,
          isDragged,
          showDropTarget,
          isRepeat = false,
          isLastPanel = false,
          isSelected = false,
          isOutside = false,
          extraStyle,
        }: {
          item: VizPanel;
          conditionalRendering?: ConditionalRenderingGroup;
          addDndContainer: boolean;
          isDragged: boolean;
          showDropTarget: boolean;
          isRepeat?: boolean;
          isLastPanel?: boolean;
          isSelected?: boolean;
          /** The dragged item is outside of the grid, so it must not take up a cell */
          isOutside?: boolean;
          extraStyle?: React.CSSProperties;
        }) => {
          const [isConditionallyHidden, conditionalRenderingClass, conditionalRenderingOverlay, renderHidden] =
            useIsConditionallyHidden(conditionalRendering);

          // Only the last panel gets the intercept, so a repeat shows one handle for the group.
          const showResizeIntercept = isEditing && isLastPanel && !isDragged;

          const wrapperClass = cx(
            conditionalRenderingClass,
            styles.wrapper,
            isDragged && !isRepeat && styles.draggedWrapper,
            isDragged && !isRepeat && isUnifiedDragAndDropEnabled() && styles.draggedWrapperFixed,
            isDragged && isRepeat && styles.draggedRepeatWrapper,
            isSelected && 'dashboard-selected-element'
          );

          const wrapperContent = (
            <>
              {autoHeightPanelsEnabled ? (
                <VizPanelFitScope enabled={fitContentOn} minHeight={fitMinHeightPx} maxHeight={fitMaxHeightPx}>
                  <item.Component model={item} />
                </VizPanelFitScope>
              ) : (
                <item.Component model={item} />
              )}
              {conditionalRenderingOverlay}
              {showResizeIntercept && <AutoGridResizeIntercept item={model} />}
            </>
          );

          return isConditionallyHidden && !isEditing && !renderHidden ? null : (
            <div
              {...(addDndContainer
                ? { ref: model.containerRef, [AUTO_GRID_ITEM_DROP_TARGET_ATTR]: showDropTarget ? key : undefined }
                : {})}
              className={cx(
                isConditionallyHidden && !isEditing && styles.hidden,
                fitContentOn && styles.itemFitContent,
                isMaxHeightBounded && styles.itemMaxHeightScroll,
                isOutside && !isRepeat && styles.outOfFlow,
                isOutside && isRepeat && styles.hidden
              )}
              style={isOutside ? undefined : extraStyle}
            >
              {isDragged && !isOutside && <div className={styles.draggedPlaceholder} />}
              <PanelEditActionsWrapper panel={item}>
                {
                  // The lazy loader causes issues when used with conditional rendering
                  isLazy && (!isConditionallyHidden || !renderHidden) ? (
                    <LazyLoader key={item.state.key!} mode="query" className={wrapperClass}>
                      {wrapperContent}
                    </LazyLoader>
                  ) : (
                    <div className={wrapperClass}>{wrapperContent}</div>
                  )
                }
              </PanelEditActionsWrapper>
            </div>
          );
        }
      ),
    [
      model,
      isLazy,
      key,
      styles,
      isEditing,
      fitContentOn,
      isMaxHeightBounded,
      fitMinHeightPx,
      fitMaxHeightPx,
      autoHeightPanelsEnabled,
    ]
  );

  const { isSelected: isSourceSelected } = useElementSelection(body.state.key);

  if (soloPanelContext) {
    const useLazyForSoloPanel = isLazy && soloPanelContext instanceof SoloPanelContextValueWithSearchStringFilter;
    return renderMatchingSoloPanels(soloPanelContext, [body, ...repeatedPanels], useLazyForSoloPanel);
  }

  const isDragging = !!draggingKey;
  const isDragged = draggingKey === key;
  const isOutside = isDragged && !!isDraggedItemOutside;
  const showDropTarget = isDragging || !!isDropTarget;

  return (
    <>
      <Wrapper
        item={body}
        conditionalRendering={model.state.conditionalRendering}
        addDndContainer={true}
        key={body.state.key!}
        isDragged={isDragged}
        showDropTarget={showDropTarget}
        isLastPanel={repeatedPanels.length === 0}
        isOutside={isOutside}
        extraStyle={itemStyle}
      />
      {repeatedPanels.map((item, idx) => (
        <Wrapper
          item={item}
          conditionalRendering={model.state.repeatedConditionalRendering?.[idx]}
          addDndContainer={false}
          key={item.state.key!}
          isDragged={isDragged}
          showDropTarget={showDropTarget}
          isRepeat={true}
          isLastPanel={idx === repeatedPanels.length - 1}
          isSelected={isSourceSelected}
          isOutside={isOutside}
          extraStyle={itemStyle}
        />
      ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({ width: '100%', height: '100%', position: 'relative' }),
  draggedWrapper: css({
    position: 'absolute',
    zIndex: 1000,
    top: `var(${DRAGGED_ITEM_TOP})`,
    left: `var(${DRAGGED_ITEM_LEFT})`,
    width: `var(${DRAGGED_ITEM_WIDTH})`,
    height: `var(${DRAGGED_ITEM_HEIGHT})`,
    opacity: 0.8,

    '&.dashboard-visible-hidden-element': {
      position: 'absolute',
    },
  }),
  // On the unified drag and drop engine, the position is in the viewport
  draggedWrapperFixed: css({
    position: 'fixed',

    '&.dashboard-visible-hidden-element': {
      position: 'fixed',
    },
  }),
  draggedRepeatWrapper: css({
    visibility: 'hidden',
  }),
  // Takes the dragged item's cell out of the grid so the other items close the gap. Sitting at the grid's
  // origin, it keeps the floating panel inside where it is, and the panel stays mounted.
  outOfFlow: css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  }),
  draggedPlaceholder: css({
    width: '100%',
    height: '100%',
    boxShadow: `0 0 ${theme.spacing(0.5)} ${theme.colors.primary.border}`,
    background: `${theme.colors.primary.transparent}`,
    zIndex: -1,
  }),
  hidden: css({
    display: 'none',
  }),
  itemFitContent: css({
    width: '100%',
  }),
  // The panel chrome is capped (not the cell), so scroll inside its content
  // area and the panel header stays fixed while the body scrolls. The chrome is
  // a flex column (header, then content); `minHeight: 0` lets the content flex
  // item shrink to the remaining space instead of overflowing the chrome.
  // Because nothing overflows the cell, selection/hover outlines at the
  // chrome's edges stay unclipped.
  itemMaxHeightScroll: css({
    [`& [data-viz-panel-key] > div > section > [data-testid="${selectors.components.Panels.Panel.content}"]`]: {
      minHeight: 0,
      overflowY: 'auto',
    },
  }),
});
