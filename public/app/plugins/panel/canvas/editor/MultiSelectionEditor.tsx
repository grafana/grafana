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

    const newLayer = new GroupState(
      {
        type: 'group',
        elements: [],
      },
      context.instanceState.scene,
      currentSelectedElements[0].parent
    );

    currentSelectedElements.forEach((element: ElementState) => {
      newLayer.doAction(LayerActionID.Duplicate, element);
      currentLayer.doAction(LayerActionID.Delete, element);
    });

    currentLayer.elements.push(newLayer);

    context.instanceState.scene.save();
  };

  return (
    <div>
      <Button icon="plus" size="sm" variant="secondary" onClick={createNewLayer}>
        Group items
      </Button>
    </div>
  );
};
