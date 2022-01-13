import React from 'react';
import { DataTransformerID, PluginState, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import { SetGeometryOptions, setGeometryTransformer } from './setGeometry';

export const SetGeometryTransformerEditor: React.FC<TransformerUIProps<SetGeometryOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return <div>TODO... include a panel editor wrapper! (AUTO FOR NOW!!!)</div>;
};

export const setGeometryTransformRegistryItem: TransformerRegistryItem<SetGeometryOptions> = {
  id: DataTransformerID.setGeometry,
  editor: SetGeometryTransformerEditor,
  transformation: setGeometryTransformer,
  name: 'Set geometry',
  description: `Use a field value to lookup additional fields from an external source.  This currently supports spatial data, but will eventually support more formats`,
  state: PluginState.alpha,
};
