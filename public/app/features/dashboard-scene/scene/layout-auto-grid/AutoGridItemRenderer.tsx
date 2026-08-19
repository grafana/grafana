import { css, cx } from '@emotion/css';
import { memo, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useFlagGrafanaDashboardsAutoHeightPanels } from '@grafana/runtime/internal';
import { LazyLoader, sceneGraph, type SceneComponentProps, VizPanelFitScope, type VizPanel } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { type ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { useIsConditionallyHidden } from '../../conditional-rendering/hooks/useIsConditionallyHidden';
import { useSoloPanelContext, renderMatchingSoloPanels } from '../../solo/SoloPanelContext';
import { useDashboardState } from '../../utils/utils';
import { SoloPanelContextValueWithSearchStringFilter } from '../PanelSearchLayout';
import { getIsLazy } from '../layouts-shared/utils';
import { AUTO_GRID_ITEM_DROP_TARGET_ATTR } from '../types/DashboardDropTarget';

import { type AutoGridItem } from './AutoGridItem';
import {
  AutoGridLayoutManager,
  getFitMinHeightInPixels,
  getMaxHeightCssValue,
  getNamedHeightInPixels,
} from './AutoGridLayoutManager';
import { AutoGridResizeIntercept } from './AutoGridResizeIntercept';
import { DRAGGED_ITEM_HEIGHT, DRAGGED_ITEM_LEFT, DRAGGED_ITEM_TOP, DRAGGED_ITEM_WIDTH } from './const';

export function AutoGridItemRenderer({ model }: SceneComponentProps<AutoGridItem>) {
  const { body, repeatedPanels = [], key, fitContent: itemFitContent } = model.useState();
  const { draggingKey } = model.getParentGrid().useState();
  const { isEditing, preload } = useDashboardState(model);
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
  // Non-fit panels stay at the row height; when row heights aren't matched they
  // must pin to it explicitly so a tall fit sibling doesn't stretch them.
  // When a max height bounds the cell, the cap is applied to the panel chrome
  // and the scroll lives on the chrome's content area — not on this cell — so
  // the panel header stays fixed while the body scrolls (see
  // styles.itemMaxHeightClip). The value travels down via a CSS variable.
  const maxHeightCss = getMaxHeightCssValue(maxHeightMode, maxHeight);
  const isMaxHeightBounded = maxHeightCss !== 'none';
  const itemStyle = fitContentOn
    ? isMaxHeightBounded
      ? { '--auto-grid-item-max-height': maxHeightCss }
      : undefined
    : matchRowHeightsOn
      ? undefined
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
            isDragged && isRepeat && styles.draggedRepeatWrapper,
            isSelected && 'dashboard-selected-element'
          );

          const wrapperContent = (
            <>
              {autoHeightPanelsEnabled ? (
                <VizPanelFitScope enabled={fitContentOn} minHeight={fitMinHeightPx}>
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
                fitContentOn && isMaxHeightBounded && styles.itemMaxHeightClip
              )}
              style={extraStyle}
            >
              {isDragged && <div className={styles.draggedPlaceholder} />}
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
            </div>
          );
        }
      ),
    [model, isLazy, key, styles, isEditing, fitContentOn, isMaxHeightBounded, fitMinHeightPx, autoHeightPanelsEnabled]
  );

  const { isSelected: isSourceSelected } = useElementSelection(body.state.key);

  if (soloPanelContext) {
    const useLazyForSoloPanel = isLazy && soloPanelContext instanceof SoloPanelContextValueWithSearchStringFilter;
    return renderMatchingSoloPanels(soloPanelContext, [body, ...repeatedPanels], useLazyForSoloPanel);
  }

  const isDragging = !!draggingKey;
  const isDragged = draggingKey === key;
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
  draggedRepeatWrapper: css({
    visibility: 'hidden',
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
  // Cap the panel chrome itself (not the cell) and scroll inside its content
  // area, so the panel header stays fixed while the body scrolls. The chrome is
  // a flex column (header, then content); `minHeight: 0` lets the content flex
  // item shrink to the remaining space instead of overflowing the chrome.
  // Because nothing overflows the cell, selection/hover outlines at the
  // chrome's edges stay unclipped.
  itemMaxHeightClip: css({
    '& [data-viz-panel-key] > div > section': {
      maxHeight: 'var(--auto-grid-item-max-height)',
    },
    [`& [data-viz-panel-key] > div > section > [data-testid="${selectors.components.Panels.Panel.content}"]`]: {
      minHeight: 0,
      overflowY: 'auto',
    },
  }),
});
