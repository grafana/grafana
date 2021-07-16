import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { ScaleDimensionConfig, ScaleDimensionOptions } from '../dimensions';

export const ScaleDimensionEditor: FC<StandardEditorProps<ScaleDimensionConfig, ScaleDimensionOptions, any>> = ({
  value,
  onChange,
  context,
  item,
}) => {
  // TODO:
  // Somehow use context to get the current map and listen to zoom changes
  return (
    <div>
      <h3>SCALE dimension</h3>
      <pre>{JSON.stringify(item, null, '  ')}</pre>
      <h3>VALUE</h3>
      <pre>{JSON.stringify(value, null, '  ')}</pre>
    </div>
  );
};
