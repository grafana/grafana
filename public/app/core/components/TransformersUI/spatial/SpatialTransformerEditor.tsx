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

import { isLineBuilderOption, spatialTransformer } from './spatialTransformer';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';
import { getDefaultOptions, getTransformerOptionPane } from './optionsHelper';
import { SpatialCalculation, SpatialOperation, SpatialAction, SpatialTransformOptions } from './models.gen';

// Nothing defined in state
const supplier = (
  builder: PanelOptionsEditorBuilder<SpatialTransformOptions>,
  context: StandardEditorContext<SpatialTransformOptions>
) => {
  const options = context.options ?? {};

  builder.addSelect({
    path: `action`,
    name: 'Action',
    description: '',
    defaultValue: SpatialAction.Prepare,
    settings: {
      options: [
        {
          value: SpatialAction.Prepare,
          label: 'Prepare spatial field',
          description: 'Set a geometry field based on the results of other fields',
        },
        {
          value: SpatialAction.Calculate,
          label: 'Calculate value',
          description: 'Use the geometry to define a new field (heading/distance/area)',
        },
        { value: SpatialAction.Modify, label: 'Transform', description: 'Apply spatial operations to the geometry' },
      ],
    },
  });

  if (options.action === SpatialAction.Calculate) {
    builder.addSelect({
      path: `calculate.calc`,
      name: 'Function',
      description: '',
      defaultValue: SpatialCalculation.Heading,
      settings: {
        options: [
          { value: SpatialCalculation.Heading, label: 'Heading' },
          { value: SpatialCalculation.Area, label: 'Area' },
          { value: SpatialCalculation.Distance, label: 'Distance' },
        ],
      },
    });
  } else if (options.action === SpatialAction.Modify) {
    builder.addSelect({
      path: `modify.op`,
      name: 'Operation',
      description: '',
      defaultValue: SpatialOperation.AsLine,
      settings: {
        options: [
          {
            value: SpatialOperation.AsLine,
            label: 'As line',
            description: 'Create a single line feature with a vertex at each row',
          },
          {
            value: SpatialOperation.LineBuilder,
            label: 'Line builder',
            description: 'Create a line between two points',
          },
        ],
      },
    });
  }

  if (isLineBuilderOption(options)) {
    builder.addNestedOptions({
      category: ['From point'],
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
      category: ['To point'],
      path: 'modify',
      build: (b, c) => {
        const loc = (options.modify?.target ?? {}) as FrameGeometrySource;
        if (!loc.mode) {
          loc.mode = FrameGeometrySourceMode.Auto;
        }
        addLocationFields('', 'target.', b, loc);
      },
    });
  } else {
    addLocationFields('Location', 'source.', builder, options.source);
  }
};

export const SetGeometryTransformerEditor: React.FC<TransformerUIProps<SpatialTransformOptions>> = (props) => {
  // a new component is created with every change :(
  useEffect(() => {
    if (!props.options.source?.mode) {
      const opts = getDefaultOptions(supplier);
      props.onChange({ ...opts, ...props.options });
      console.log('geometry useEffect', opts);
    }
  });

  const pane = getTransformerOptionPane<SpatialTransformOptions>(props, supplier);
  return (
    <div>
      <div>{pane.items.map((v) => v.render())}</div>
      <div>{pane.categories.map((v) => v.render())}</div>
    </div>
  );
};

export const spatialTransformRegistryItem: TransformerRegistryItem<SpatialTransformOptions> = {
  id: DataTransformerID.spatial,
  editor: SetGeometryTransformerEditor,
  transformation: spatialTransformer,
  name: spatialTransformer.name,
  description: spatialTransformer.description,
  state: PluginState.alpha,
};
