import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { NumberInput } from '../components/NumberInput';

export const MapZoomEditor: FC<StandardEditorProps<number | undefined, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  // TODO:
  // Somehow use context to get the current map and listen to zoom changes
  return (
    <div>
      <NumberInput value={value} min={1} max={30} onChange={onChange} />
    </div>
  );
};
