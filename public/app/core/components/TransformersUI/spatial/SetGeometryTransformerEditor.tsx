import React, { useEffect } from 'react';
import {
  DataTransformerID,
  FrameGeometrySource,
  FrameGeometrySourceMode,
  PanelOptionsEditorBuilder,
  PluginState,
  StandardEditorContext,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import { isLineToOption, spatialTransformer } from './setGeometry';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';
import { getDefaultOptions, getTransformerOptionPane } from './optionsHelper';
import { CalculateFunction, ModifyFunction, SetGeometryAction, SetGeometryOptions } from './models.gen';

// Nothing defined in state
const supplier = (
  builder: PanelOptionsEditorBuilder<SetGeometryOptions>,
  context: StandardEditorContext<SetGeometryOptions>
) => {
  const options = context.options ?? {};

  builder.addSelect({
    path: `action`,
    name: 'Action',
    description: '',
    defaultValue: SetGeometryAction.Prepare,
    settings: {
      options: [
        {
          value: SetGeometryAction.Prepare,
          label: 'Prepare spatial field',
          description: 'Set a geometry field based on the results of other fields',
        },
        {
          value: SetGeometryAction.Calculate,
          label: 'Calculate value',
          description: 'Use the geometry to define a new field (heading/distance/area)',
        },
        { value: SetGeometryAction.Modify, label: 'Modify spatial field' },
      ],
    },
  });

  if (options.action === SetGeometryAction.Calculate) {
    builder.addSelect({
      path: `calculate.what`,
      name: 'Function',
      description: '',
      defaultValue: CalculateFunction.Area,
      settings: {
        options: [
          { value: CalculateFunction.Area, label: 'Area' },
          { value: CalculateFunction.Distance, label: 'Distance' },
          { value: CalculateFunction.Heading, label: 'Heading' },
        ],
      },
    });
  } else if (options.action === SetGeometryAction.Modify) {
    builder.addSelect({
      path: `modify.fn`,
      name: 'Function',
      description: '',
      defaultValue: ModifyFunction.AsLine,
      settings: {
        options: [
          { value: ModifyFunction.AsLine, label: 'As line' },
          { value: ModifyFunction.LineTo, label: 'Connect line' },
        ],
      },
    });
  }

  if (isLineToOption(options)) {
    builder.addNestedOptions({
      category: ['Source'],
      path: 'source',
      build: (b, c) => {
        const loc = (options.source ?? {}) as FrameGeometrySource;
        if (!loc.mode) {
          loc.mode = FrameGeometrySourceMode.Auto;
        }
        addLocationFields('', '', b, loc);
      },
    });

    builder.addNestedOptions({
      category: ['Target'],
      path: 'modify',
      build: (b, c) => {
        const loc = (options.modify?.lineTo ?? {}) as FrameGeometrySource;
        if (!loc.mode) {
          loc.mode = FrameGeometrySourceMode.Auto;
        }
        addLocationFields('', 'lineTo.', b, loc);
      },
    });
  } else {
    addLocationFields('Location', 'source.', builder, options.source);
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
  return (
    <div>
      <div>{pane.items.map((v) => v.render())}</div>
      <div>{pane.categories.map((v) => v.render())}</div>
    </div>
  );
};

export const setGeometryTransformRegistryItem: TransformerRegistryItem<SetGeometryOptions> = {
  id: DataTransformerID.spatial,
  editor: SetGeometryTransformerEditor,
  transformation: spatialTransformer,
  name: spatialTransformer.name,
  description: spatialTransformer.description,
  state: PluginState.alpha,
};
