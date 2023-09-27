import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import {
  DataTransformerID,
  GrafanaTheme2,
  PanelOptionsEditorBuilder,
  PluginState,
  StandardEditorContext,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { FrameGeometrySource, FrameGeometrySourceMode } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';

import { SpatialCalculation, SpatialOperation, SpatialAction, SpatialTransformOptions } from './models.gen';
import { getDefaultOptions, getTransformerOptionPane } from './optionsHelper';
import { isLineBuilderOption, spatialTransformer } from './spatialTransformer';

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
      category: ['Source'],
      path: 'source',
      build: (b, c) => {
        const loc = (options.source ?? {}) as FrameGeometrySource;
        if (!loc.mode) {
          loc.mode = FrameGeometrySourceMode.Auto;
        }
        addLocationFields('Point', '', b, loc);
      },
    });

    builder.addNestedOptions({
      category: ['Target'],
      path: 'modify',
      build: (b, c) => {
        const loc = (options.modify?.target ?? {}) as FrameGeometrySource;
        if (!loc.mode) {
          loc.mode = FrameGeometrySourceMode.Auto;
        }
        addLocationFields('Point', 'target.', b, loc);
      },
    });
  } else {
    addLocationFields('Location', 'source.', builder, options.source);
  }
};

type Props = TransformerUIProps<SpatialTransformOptions>;

export const SetGeometryTransformerEditor = (props: Props) => {
  // a new component is created with every change :(
  useEffect(() => {
    if (!props.options.source?.mode) {
      const opts = getDefaultOptions(supplier);
      props.onChange({ ...opts, ...props.options });
      console.log('geometry useEffect', opts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = getStyles(useTheme2());

  const pane = getTransformerOptionPane<SpatialTransformOptions>(props, supplier);
  return (
    <div>
      <div>{pane.items.map((v) => v.render())}</div>
      <div>
        {pane.categories.map((c) => {
          return (
            <div key={c.props.id} className={styles.wrap}>
              <h5>{c.props.title}</h5>
              <div className={styles.item}>{c.items.map((s) => s.render())}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      margin-bottom: 20px;
    `,
    item: css`
      border-left: 4px solid ${theme.colors.border.strong};
      padding-left: 10px;
    `,
  };
};

export const spatialTransformRegistryItem: TransformerRegistryItem<SpatialTransformOptions> = {
  id: DataTransformerID.spatial,
  editor: SetGeometryTransformerEditor,
  transformation: spatialTransformer,
  name: spatialTransformer.name,
  description: spatialTransformer.description,
  state: PluginState.alpha,
  categories: new Set([TransformerCategory.PerformSpatialOperations]),
};
