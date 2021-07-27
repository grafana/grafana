import React, { FC, useMemo } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { CanvasLayerOptions } from '../base';
import { PanelOptions } from '../models.gen';
import { CanvasElementEditor } from './ElementEditor';
import { DEFAULT_ELEMENT_CONFIG } from '../elements/registry';

export const SelectedElementEditor: FC<StandardEditorProps<CanvasLayerOptions, any, PanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const selectedElement = useMemo(() => {
    return value?.elements[0] ?? { ...DEFAULT_ELEMENT_CONFIG };
  }, [value]);

  return (
    <CanvasElementEditor
      options={selectedElement}
      data={context.data}
      onChange={(cfg) => {
        console.log('Change element:', cfg);
        onChange({ ...value, elements: [cfg] });
      }}
    />
  );
};
