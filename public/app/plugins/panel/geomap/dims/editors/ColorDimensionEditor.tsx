import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { ColorDimensionConfig } from '../dimensions';

export const ColorDimensionEditor: FC<StandardEditorProps<ColorDimensionConfig, any, any>> = ({
  value,
  onChange,
  context,
}) => {
  // TODO:
  // Somehow use context to get the current map and listen to zoom changes
  return (
    <div>
      <h3>ColorDimensionEditor</h3>
      <pre>{`${context.options}`}</pre>
    </div>
  );
};
