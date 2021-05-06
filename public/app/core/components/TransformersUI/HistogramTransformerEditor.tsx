import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import { HistogramTransformerOptions } from '@grafana/data/src/transformations/transformers/histogram';

export const HistogramTransformerEditor: React.FC<TransformerUIProps<HistogramTransformerOptions>> = ({}) => {
  return <div>TODO.... show bucket size option</div>;
};

export const histogramTransformRegistryItem: TransformerRegistryItem<HistogramTransformerOptions> = {
  id: DataTransformerID.histogram,
  editor: HistogramTransformerEditor,
  transformation: standardTransformers.histogramTransformer,
  name: standardTransformers.histogramTransformer.name,
  description: standardTransformers.histogramTransformer.description,
};
