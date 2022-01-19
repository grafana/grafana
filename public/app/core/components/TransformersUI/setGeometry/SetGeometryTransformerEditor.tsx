import React, { useEffect } from 'react';
import {
  DataTransformerID,
  PanelOptionsEditorBuilder,
  PluginState,
  StandardEditorContext,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import { SetGeometryOptions, setGeometryTransformer, SetGeometryAction } from './setGeometry';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';
import { getDefaultOptions, getTransformerOptionPane } from './optionsHelper';

// Nothing defined in state
const supplier = (
  builder: PanelOptionsEditorBuilder<SetGeometryOptions>,
  context: StandardEditorContext<SetGeometryOptions>
) => {
  addLocationFields('Location in row', 'source', builder, context.options?.source);

  builder.addRadio({
    path: `action`,
    name: 'Action',
    description: '',
    defaultValue: SetGeometryAction.SetField,
    settings: {
      options: [
        { value: SetGeometryAction.SetField, label: 'Set field' },
        { value: SetGeometryAction.LineTo, label: 'Line to' },
      ],
    },
  });

  if (context.options?.action === SetGeometryAction.LineTo) {
    addLocationFields('Target location', 'lineTo.target', builder, context.options.lineTo?.target);

    builder.addBooleanSwitch({
      name: 'Calculate distance',
      path: 'lineTo.calculateDistance',
    });
  }
};

export const SetGeometryTransformerEditor: React.FC<TransformerUIProps<SetGeometryOptions>> = (props) => {
  // a new component is created with every change :(
  useEffect(() => {
    if (!props.options.source?.mode) {
      const opts = getDefaultOptions(supplier);
      props.onChange({ ...opts, ...props.options });
      console.log('geometry useEffect', opts);
    }
  });

  const pane = getTransformerOptionPane<SetGeometryOptions>(props, supplier);
  return <div>{pane.items.map((v) => v.render())}</div>;
};

export const setGeometryTransformRegistryItem: TransformerRegistryItem<SetGeometryOptions> = {
  id: DataTransformerID.setGeometry,
  editor: SetGeometryTransformerEditor,
  transformation: setGeometryTransformer,
  name: 'Set geometry',
  description: `Use a field value to lookup additional fields from an external source.  This currently supports spatial data, but will eventually support more formats`,
  state: PluginState.alpha,
};
