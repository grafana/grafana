import React, { FC } from 'react';
import { Button } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

import { InstanceState } from '../CanvasPanel';
import { PanelOptions } from '../models.gen';
import { GroupState } from 'app/features/canvas/runtime/group';
import { ElementState } from 'app/features/canvas/runtime/element';
import { LayerActionID } from '../types';

export const MultiSelectionEditor: FC<StandardEditorProps<any, InstanceState, PanelOptions>> = ({ context }) => {
  const createNewLayer = () => {
    const currentSelectedElements = context?.instanceState.selected;
    const currentLayer = currentSelectedElements[0].parent;

    // Create new group and attach currentSelected elements to that group
    const newLayer = new GroupState(
      {
        type: 'group',
        elements: [],
      },
      context.instanceState.scene,
      currentSelectedElements[0].parent
    );

    // Remove old elements from current layer
    // This approach is working currently for some reason...
    // currentLayer.elements.filter((element: ElementState) => !currentSelectedElements.includes(element));

    currentSelectedElements.forEach((element: ElementState) => {
      newLayer.doAction(LayerActionID.Duplicate, element);
      currentLayer.doAction(LayerActionID.Delete, element);
    });

    // add new group as element to current layer
    currentLayer.elements.push(newLayer);

    context.instanceState.scene.save();
    currentLayer.reinitializeMoveable();

    // Update current layer displayed in UI
    // Add conditional rendering button to access parent root level
  };

  return (
    <div>
      <Button size="sm" variant="secondary" onClick={createNewLayer}>
        Create New Layer
      </Button>
    </div>
  );
};
