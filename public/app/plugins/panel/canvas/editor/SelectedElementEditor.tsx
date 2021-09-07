import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { PanelOptions } from '../models.gen';
import { CanvasElementEditor } from './ElementEditor';
import { theScene } from '../CanvasPanel';
import { useObservable } from 'react-use';
import { of } from 'rxjs';
import { CanvasGroupOptions } from 'app/features/canvas';

export const SelectedElementEditor: FC<StandardEditorProps<CanvasGroupOptions, any, PanelOptions>> = ({ context }) => {
  const scene = useObservable(theScene);
  const selected = useObservable(scene?.selected ?? of(undefined));

  if (!selected) {
    return <div>No item is selected</div>;
  }

  return (
    <CanvasElementEditor
      options={selected.options}
      data={context.data}
      onChange={(cfg) => {
        scene!.onChange(selected.UID, cfg);
      }}
    />
  );
};
