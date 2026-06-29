import { css, cx } from '@emotion/css';
import { memo, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, sceneGraph, type SceneComponentProps, VizPanelFitContext, type VizPanel } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { type ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { useIsConditionallyHidden } from '../../conditional-rendering/hooks/useIsConditionallyHidden';
import { useSoloPanelContext, renderMatchingSoloPanels } from '../../solo/SoloPanelContext';
import { useDashboardState } from '../../utils/utils';
import { SoloPanelContextValueWithSearchStringFilter } from '../PanelSearchLayout';
import { getIsLazy } from '../layouts-shared/utils';
import { AUTO_GRID_ITEM_DROP_TARGET_ATTR } from '../types/DashboardDropTarget';

import { type AutoGridItem } from './AutoGridItem';
import { AutoGridLayoutManager, getMaxHeightCssValue, getNamedHeightInPixels } from './AutoGridLayoutManager';
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

  // Content-fit only applies to panels whose plugin supports it. A per-panel
  // override (opt-in/opt-out) wins over the layout default.
  const pluginSupportsFit = body.getPlugin()?.supportsFitContent === true;
  const fitContentOn = pluginSupportsFit && (itemFitContent ?? layoutFitContent ?? false);
  const matchRowHeightsOn = matchRowHeights !== false;
  const rowHeightPx = getNamedHeightInPixels(rowHeight);
  const fitMinHeightPx = getNamedHeightInPixels(minHeight ?? rowHeight);

  // Fit-content sizing is pure CSS: the cell caps the height and the browser
  // sizes the row to content. The min-height floor is applied to the panel
  // chrome (via the fit context) so the chrome itself fills it — a min-height on
  // this cell would leave the chrome floating at the top.
  // Non-fit panels stay at the row height; when row heights aren't matched they
  // must pin to it explicitly so a tall fit sibling doesn't stretch them.
  const itemStyle: React.CSSProperties | undefined = fitContentOn
    ? { maxHeight: getMaxHeightCssValue(maxHeightMode, maxHeight), overflow: 'auto' }
    : matchRowHeightsOn
      ? undefined
      : { height: rowHeightPx };

  const fitContentValue = useMemo(
    () => ({ enabled: fitContentOn, minHeight: fitMinHeightPx }),
    [fitContentOn, fitMinHeightPx]
  );

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
          isSelected = false,
          extraStyle,
        }: {
          item: VizPanel;
          conditionalRendering?: ConditionalRenderingGroup;
          addDndContainer: boolean;
          isDragged: boolean;
          showDropTarget: boolean;
          isRepeat?: boolean;
          isSelected?: boolean;
          extraStyle?: React.CSSProperties;
        }) => {
          const [isConditionallyHidden, conditionalRenderingClass, conditionalRenderingOverlay, renderHidden] =
            useIsConditionallyHidden(conditionalRendering);

          return isConditionallyHidden && !isEditing && !renderHidden ? null : (
            <div
              {...(addDndContainer
                ? { ref: model.containerRef, [AUTO_GRID_ITEM_DROP_TARGET_ATTR]: showDropTarget ? key : undefined }
                : {})}
              className={cx(
                isConditionallyHidden && !isEditing && styles.hidden,
                fitContentOn && styles.itemFitContent
              )}
              style={extraStyle}
            >
              {isDragged && <div className={styles.draggedPlaceholder} />}
              {
                // The lazy loader causes issues when used with conditional rendering
                isLazy && (!isConditionallyHidden || !renderHidden) ? (
                  <LazyLoader
                    key={item.state.key!}
                    mode="query"
                    className={cx(
                      conditionalRenderingClass,
                      styles.wrapper,
                      isDragged && !isRepeat && styles.draggedWrapper,
                      isDragged && isRepeat && styles.draggedRepeatWrapper,
                      isSelected && 'dashboard-selected-element'
                    )}
                  >
                    <VizPanelFitContext.Provider value={fitContentValue}>
                      <item.Component model={item} />
                    </VizPanelFitContext.Provider>
                    {conditionalRenderingOverlay}
                  </LazyLoader>
                ) : (
                  <div
                    className={cx(
                      conditionalRenderingClass,
                      styles.wrapper,
                      isDragged && !isRepeat && styles.draggedWrapper,
                      isDragged && isRepeat && styles.draggedRepeatWrapper,
                      isSelected && 'dashboard-selected-element'
                    )}
                  >
                    <VizPanelFitContext.Provider value={fitContentValue}>
                      <item.Component model={item} />
                    </VizPanelFitContext.Provider>
                    {conditionalRenderingOverlay}
                  </div>
                )
              }
            </div>
          );
        }
      ),
    [model, isLazy, key, styles, isEditing, fitContentOn, fitContentValue]
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
});
