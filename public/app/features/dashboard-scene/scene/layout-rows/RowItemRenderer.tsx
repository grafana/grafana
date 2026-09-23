import { type SceneComponentProps } from '@grafana/scenes';
import { useDragAndDrop } from '@grafana/ui/internal';

import { useIsConditionallyHidden } from '../../conditional-rendering/hooks/useIsConditionallyHidden';
import { useSoloPanelContext } from '../../solo/SoloPanelContext';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { useDashboardState } from '../../utils/utils';

import { RowContainer } from './RowContainer';
import { type RowItem } from './RowItem';

export function RowItemRenderer({ model }: SceneComponentProps<RowItem>) {
  const { layout, key, conditionalRendering } = model.useState();
  const { isEditing } = useDashboardState(model);
  const [isConditionallyHidden, conditionalRenderingClass, conditionalRenderingOverlay] =
    useIsConditionallyHidden(conditionalRendering);
  const { rows } = model.getParentLayout().useState();
  const soloPanelContext = useSoloPanelContext();
  const isDraggable = !isRepeatCloneOrChildOf(model) && Boolean(isEditing);
  const { Draggable } = useDragAndDrop(isDraggable);

  if (isConditionallyHidden && !isEditing) {
    return null;
  }
  if (soloPanelContext) {
    return <layout.Component model={layout} />;
  }

  return (
    <Draggable key={key!} draggableId={key!} index={rows.indexOf(model)} isDragDisabled={!isDraggable}>
      {(dragProvided, dragSnapshot) => (
        <RowContainer
          model={model}
          dragProvided={dragProvided}
          isDragging={dragSnapshot.isDragging}
          isDraggable={isDraggable}
          conditionalRenderingClass={conditionalRenderingClass}
          conditionalRenderingOverlay={conditionalRenderingOverlay}
        />
      )}
    </Draggable>
  );
}
