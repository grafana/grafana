import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { useLocation } from 'react-router';

import { locationUtil, textUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Tab, useElementSelection, usePointerDistance, useStyles2 } from '@grafana/ui';

import { useDashboardState } from '../../utils/utils';

import { TabItem } from './TabItem';

export function TabItemRenderer({ model }: SceneComponentProps<TabItem>) {
  const { title, key, isDropTarget } = model.useState();
  const parentLayout = model.getParentLayout();
  const { tabs, currentTabIndex } = parentLayout.useState();
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const { isSelected, onSelect, isSelectable } = useElementSelection(key);
  const { isEditing } = useDashboardState(model);
  const mySlug = model.getSlug();
  const urlKey = parentLayout.getUrlKey();
  const myIndex = tabs.findIndex((tab) => tab === model);
  const isActive = myIndex === currentTabIndex;
  const location = useLocation();
  const href = textUtil.sanitize(locationUtil.getUrlForPartial(location, { [urlKey]: mySlug }));
  const styles = useStyles2(getStyles);
  const pointerDistance = usePointerDistance();

  return (
    <Draggable key={key!} draggableId={key!} index={myIndex} isDragDisabled={!isEditing}>
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
              isSelected && 'dashboard-selected-element',
              isSelectable && !isSelected && 'dashboard-selectable-element',
              isDropTarget && 'dashboard-drop-target'
            )}
            active={isActive}
            role="presentation"
            title={titleInterpolated}
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
          />
        </div>
      )}
    </Draggable>
  );
}

const getStyles = () => ({
  dragging: css({
    cursor: 'move',
  }),
});
