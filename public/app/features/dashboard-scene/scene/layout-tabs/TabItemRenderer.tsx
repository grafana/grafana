import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { useLocation } from 'react-router';

import { locationUtil, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Box, Icon, Tab, Tooltip, useElementSelection, usePointerDistance, useStyles2 } from '@grafana/ui';

import { useIsConditionallyHidden } from '../../conditional-rendering/useIsConditionallyHidden';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { useDashboardState } from '../../utils/utils';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const { title, key, isDropTarget } = model.useState();
  const parentLayout = model.getParentLayout();
  const { currentTabSlug } = parentLayout.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect, isSelectable } = useElementSelection(key);
  const { isEditing } = useDashboardState(model);
  const mySlug = model.getSlug();
  const urlKey = parentLayout.getUrlKey();
  const isActive = mySlug === currentTabSlug;
  const location = useLocation();
  const href = textUtil.sanitize(locationUtil.getUrlForPartial(location, { [urlKey]: mySlug }));
  const styles = useStyles2(getStyles);
  const pointerDistance = usePointerDistance();
  const [isConditionallyHidden] = useIsConditionallyHidden(model);
  const isClone = isRepeatCloneOrChildOf(model);

  const isDraggable = !isClone && isEditing;

  if (isConditionallyHidden && !isEditing && !isActive) {
    return null;
  }

  let titleCollisionProps = {};

  if (!model.hasUniqueTitle()) {
    titleCollisionProps = {
      icon: 'exclamation-triangle',
      tooltip: t('dashboard.tabs-layout.tab-warning.title-not-unique', 'This title is not unique'),
    };
  }

  return (
    <Draggable key={key!} draggableId={key!} index={myIndex} isDragDisabled={!isDraggable}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={(ref) => dragProvided.innerRef(ref)}
          className={cx(dragSnapshot.isDragging && styles.dragging)}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
        >
          <Tab
            ref={model.containerRef}
            truncate
            className={cx(
              isConditionallyHidden && styles.hidden,
              isSelected && 'dashboard-selected-element',
              isSelectable && !isSelected && 'dashboard-selectable-element',
              isDropTarget && 'dashboard-drop-target'
            )}
            active={isActive}
            title={titleInterpolated}
            suffix={isConditionallyHidden ? IsHiddenSuffix : undefined}
            href={href}
            aria-selected={isActive}
            onPointerDown={(evt) => {
              evt.stopPropagation();
              pointerDistance.set(evt);
            }}
            onPointerUp={(evt) => {
              evt.stopPropagation();

              if (!isSelectable || pointerDistance.check(evt)) {
                return;
              }

              onSelect?.(evt);
            }}
            label={titleInterpolated}
            data-dashboard-drop-target-key={model.state.key}
            {...titleCollisionProps}
          />
        </div>
      )}
    </Draggable>
  );
}

function IsHiddenSuffix() {
  return (
    <Box paddingLeft={1} display={'inline'}>
      <Tooltip
        content={t(
          'dashboard.conditional-rendering.overlay.tooltip',
          'Element is hidden due to conditional rendering.'
        )}
      >
        <Icon name="eye-slash" />
      </Tooltip>
    </Box>
  );
}

const getStyles = () => ({
  dragging: css({
    cursor: 'move',
  }),
  hidden: css({
    opacity: 0.4,

    '&:hover': css({
      opacity: 1,
    }),
  }),
});
