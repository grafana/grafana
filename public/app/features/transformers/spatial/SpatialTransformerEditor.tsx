import { css } from '@emotion/css';
import { useEffect } from 'react';

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
import { t } from '@grafana/i18n';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/spatial.svg';
import lightImage from '../images/light/spatial.svg';

import { SpatialCalculation, SpatialOperation, SpatialAction, SpatialTransformOptions } from './models.gen';
import { getDefaultOptions, getTransformerOptionPane } from './optionsHelper';
import { isLineBuilderOption, getSpatialTransformer } from './spatialTransformer';

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
          label: t('transformers.supplier.label.prepare-spatial-field', 'Prepare spatial field'),
          description: 'Set a geometry field based on the results of other fields',
        },
        {
          value: SpatialAction.Calculate,
          label: t('transformers.supplier.label.calculate-value', 'Calculate value'),
          description: t(
            'transformers.supplier.description.geometry-define-field-headingdistancearea',
            'Use the geometry to define a new field (heading/distance/area)'
          ),
        },
        {
          value: SpatialAction.Modify,
          label: t('transformers.supplier.label.transform', 'Transform'),
          description: t(
            'transformers.supplier.description.apply-spatial-operations-to-the-geometry',
            'Apply spatial operations to the geometry'
          ),
        },
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
          { value: SpatialCalculation.Heading, label: t('transformers.supplier.label.heading', 'Heading') },
          { value: SpatialCalculation.Area, label: t('transformers.supplier.label.area', 'Area') },
          { value: SpatialCalculation.Distance, label: t('transformers.supplier.label.distance', 'Distance') },
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
            label: t('transformers.supplier.label.as-line', 'As line'),
            description: 'Create a single line feature with a vertex at each row',
          },
          {
            value: SpatialOperation.LineBuilder,
            label: t('transformers.supplier.label.line-builder', 'Line builder'),
            description: t(
              'transformers.supplier.description.create-a-line-between-two-points',
              'Create a line between two points'
            ),
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
        const loc = options.source ?? {
          mode: FrameGeometrySourceMode.Auto,
        };
        addLocationFields('Point', '', b, loc);
      },
    });

    builder.addNestedOptions({
      category: ['Target'],
      path: 'modify',
      build: (b, c) => {
        const loc = options.modify?.target ?? {
          mode: FrameGeometrySourceMode.Auto,
        };
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
    wrap: css({
      marginBottom: '20px',
    }),
    item: css({
      borderLeft: `4px solid ${theme.colors.border.strong}`,
      paddingLeft: '10px',
    }),
  };
};

export const getSpatialTransformRegistryItem: () => TransformerRegistryItem<SpatialTransformOptions> = () => {
  const spatialTransformer = getSpatialTransformer();
  return {
    id: DataTransformerID.spatial,
    editor: SetGeometryTransformerEditor,
    transformation: spatialTransformer,
    name: spatialTransformer.name,
    description: spatialTransformer.description,
    state: PluginState.alpha,
    categories: new Set([TransformerCategory.PerformSpatialOperations]),
    help: getTransformationContent(DataTransformerID.spatial).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  };
};
