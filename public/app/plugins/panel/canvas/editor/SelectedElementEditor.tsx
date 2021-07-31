import React, { FC, useEffect, useState } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { CanvasGroupOptions } from '../base';
import { PanelOptions } from '../models.gen';
import { CanvasElementEditor } from './ElementEditor';
import { lastCanvasPanelInstance } from '../CanvasPanel';
import { useObservable } from 'react-use';
import { of } from 'rxjs';

export const SelectedElementEditor: FC<StandardEditorProps<CanvasGroupOptions, any, PanelOptions>> = ({ context }) => {
  const [scene, setScene] = useState(lastCanvasPanelInstance?.scene);

  useEffect(() => {
    if (scene) {
      return;
    }

    console.log('Lazy load the scene');
    const timer = setTimeout(() => setScene(lastCanvasPanelInstance?.scene), 350);
    return () => {
      clearTimeout(timer);
    };
  }, [scene]);

  const selected = useObservable(scene?.selected ?? of(undefined));
  if (!selected) {
    return <div>No item is selected (todo, loop!) or... close and reopen the element to get values!</div>;
  }

  return (
    <CanvasElementEditor
      options={selected.options}
      data={context.data}
      onChange={(cfg) => {
        lastCanvasPanelInstance!.scene.onChange(selected.UID, cfg);
      }}
    />
  );
};
