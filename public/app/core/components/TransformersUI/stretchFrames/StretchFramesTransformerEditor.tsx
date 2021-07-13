import React from 'react';
import { TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { stretchFramesTransformer, StretchFramesTransformerOptions } from './stretchFrames';

export const StretchTransformerEditor: React.FC<TransformerUIProps<StretchFramesTransformerOptions>> = () => {
  return null;
};

export const stretchFrameTransformerRegistryItem: TransformerRegistryItem<StretchFramesTransformerOptions> = {
  id: stretchFramesTransformer.id,
  editor: StretchTransformerEditor,
  transformation: stretchFramesTransformer,
  name: 'Stretch frames',
  description: `Will stretch data frames from the wide format into the long format. This is really helpful to be able to keep backwards compatability for panels not supporting the new wide format.`,
};
