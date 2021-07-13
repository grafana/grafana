import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { StretchFramesTransformerOptions } from '../../../../../packages/grafana-data/src/transformations/transformers/stretch';

export const StretchTransformerEditor: React.FC<TransformerUIProps<StretchFramesTransformerOptions>> = () => {
  return null;
};

export const stretchFrameTransformerRegistryItem: TransformerRegistryItem<StretchFramesTransformerOptions> = {
  id: DataTransformerID.stretchFrames,
  editor: StretchTransformerEditor,
  transformation: standardTransformers.stretchFramesTransformer,
  name: 'Stretch frames',
  description: `Will stretch data frames from the wide format into the long format. This is really helpful to be able to keep backwards compatability for panels not supporting the new wide format.`,
};
