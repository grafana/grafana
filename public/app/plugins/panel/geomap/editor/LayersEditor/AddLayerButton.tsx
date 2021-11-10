import React from 'react';
import { ValuePicker } from '@grafana/ui';

import { geomapLayerRegistry } from '../../layers/registry';
import { dataLayerFilter } from '../layerEditor';
import { GeomapLayerActions } from '../../GeomapPanel';

type AddLayerButtonProps = { actions: GeomapLayerActions };

export const AddLayerButton = ({ actions }: AddLayerButtonProps) => {
  return (
    <ValuePicker
      icon="plus"
      label="Add layer"
      variant="secondary"
      options={geomapLayerRegistry.selectOptions(undefined, dataLayerFilter).options}
      onChange={(v) => actions.addlayer(v.value!)}
      isFullWidth={true}
    />
  );
};
