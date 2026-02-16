import { css, cx } from '@emotion/css';
import { memo, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, sceneGraph, type SceneComponentProps, type VizPanel } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { type ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { ConditionalRenderingOverlay } from '../../conditional-rendering/hooks/ConditionalRenderingOverlay';
import { useIsConditionallyHidden } from '../../conditional-rendering/hooks/useIsConditionallyHidden';
import { useRuleBasedVisibility } from '../../conditional-rendering/hooks/useRuleBasedVisibility';
import { useDashboardState } from '../../utils/utils';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { SoloPanelContextValueWithSearchStringFilter } from '../PanelSearchLayout';
import { useSoloPanelContext, renderMatchingSoloPanels } from '../SoloPanelContext';
import { getIsLazy } from '../layouts-shared/utils';
import { AUTO_GRID_ITEM_DROP_TARGET_ATTR } from '../types/DashboardDropTarget';

import { type AutoGridItem } from './AutoGridItem';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';
import { DRAGGED_ITEM_HEIGHT, DRAGGED_ITEM_LEFT, DRAGGED_ITEM_TOP, DRAGGED_ITEM_WIDTH } from './const';

export function AutoGridItemRenderer({ model }: SceneComponentProps<AutoGridItem>) {
  const { body, repeatedPanels = [], key } = model.useState();
  const { draggingKey } = model.getParentGrid().useState();
  const { isEditing, preload } = useDashboardState(model);
  const styles = useStyles2(getStyles);
  const soloPanelContext = useSoloPanelContext();
  const isLazy = useMemo(() => getIsLazy(preload), [preload]);

  // Check if this grid is a drop target for external drags
  const layoutManager = sceneGraph.getAncestor(model, AutoGridLayoutManager);
  const { isDropTarget } = layoutManager.useState();

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
        }: {
          item: VizPanel;
          conditionalRendering?: ConditionalRenderingGroup;
          addDndContainer: boolean;
          isDragged: boolean;
          showDropTarget: boolean;
          isRepeat?: boolean;
          isSelected?: boolean;
        }) => {
          const [isConditionallyHidden, elementCrClass, elementCrOverlay, renderHidden] =
            useIsConditionallyHidden(conditionalRendering);

          // Dashboard-level rule-based visibility (targets panels by element reference)
          const elementId = dashboardSceneGraph.getElementIdentifierForVizPanel(item);
          const ruleHidden = useRuleBasedVisibility(item, `element:${elementId}`);
          const isHiddenByRules = ruleHidden === true;
          const isHidden = isConditionallyHidden || isHiddenByRules;

          // Show overlay/class from either source
          const conditionalRenderingClass = isHidden ? 'dashboard-visible-hidden-element' : elementCrClass;
          const conditionalRenderingOverlay = isHidden
            ? elementCrOverlay ?? <ConditionalRenderingOverlay />
            : elementCrOverlay;

          return isHidden && !isEditing && !renderHidden ? null : (
            <div
              {...(addDndContainer
                ? { ref: model.containerRef, [AUTO_GRID_ITEM_DROP_TARGET_ATTR]: showDropTarget ? key : undefined }
                : {})}
              className={cx(isHidden && !isEditing && styles.hidden)}
            >
              {isDragged && <div className={styles.draggedPlaceholder} />}
              {
                // The lazy loader causes issues when used with conditional rendering
                isLazy && (!isHidden || !renderHidden) ? (
                  <LazyLoader
                    key={item.state.key!}
                    className={cx(
                      conditionalRenderingClass,
                      styles.wrapper,
                      isDragged && !isRepeat && styles.draggedWrapper,
                      isDragged && isRepeat && styles.draggedRepeatWrapper,
                      isSelected && 'dashboard-selected-element'
                    )}
                  >
                    <item.Component model={item} />
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
                    <item.Component model={item} />
                    {conditionalRenderingOverlay}
                  </div>
                )
              }
            </div>
          );
        }
      ),
    [model, isLazy, key, styles, isEditing]
  );

  const { isSelected: isSourceSelected } = useElementSelection(body.state.key);

  if (soloPanelContext) {
    // Use lazy loading only for panel search layout (SoloPanelContextValueWithSearchStringFilter)
    // as it renders multiple panels in a grid. Skip lazy loading for viewPanel URL param
    // (SoloPanelContextWithPathIdFilter) since single panels should render immediately.
    const useLazyForSoloPanel = isLazy && soloPanelContext instanceof SoloPanelContextValueWithSearchStringFilter;
    return renderMatchingSoloPanels(soloPanelContext, [body, ...repeatedPanels], useLazyForSoloPanel);
  }

  const isDragging = !!draggingKey;
  const isDragged = draggingKey === key;
  // Show drop target attribute for both internal drags and external drags (when this grid is a drop target)
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

    // Unfortunately, we need to re-enforce the absolute position here. Otherwise, the position will be overwritten with
    //  a relative position by .dashboard-visible-hidden-element
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
});
