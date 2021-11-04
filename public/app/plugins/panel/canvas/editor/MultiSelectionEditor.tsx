import React, { FC } from 'react';
import { Button } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { InstanceState } from '../CanvasPanel';
import { PanelOptions } from '../models.gen';

export const MultiSelectionEditor: FC<StandardEditorProps<any, InstanceState, PanelOptions>> = ({ context }) => {
  const createNewLayer = () => {
    console.log('TODO: create new layer');

    const currentSelectedElements = context?.instanceState.selected;

    console.log(currentSelectedElements);
  };

  return (
    <div>
      <Button size="sm" variant="secondary" onClick={createNewLayer}>
        Create New Layer
      </Button>
    </div>
  );
};
