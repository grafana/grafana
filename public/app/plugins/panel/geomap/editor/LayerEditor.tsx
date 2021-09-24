import React, { FC, useMemo } from 'react';
import { Select } from '@grafana/ui';
import {
  MapLayerOptions,
  DataFrame,
  MapLayerRegistryItem,
  PanelOptionsEditorBuilder,
  StandardEditorContext,
  FrameGeometrySourceMode,
  FieldType,
  Field,
} from '@grafana/data';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { GazetteerPathEditor } from './GazetteerPathEditor';
import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { defaultMarkersConfig } from '../layers/data/markersLayer';

export interface LayerEditorProps<TConfig = any> {
  options?: MapLayerOptions<TConfig>;
  data: DataFrame[]; // All results
  onChange: (options: MapLayerOptions<TConfig>) => void;
  filter: (item: MapLayerRegistryItem) => boolean;
}

export interface LayerEditorOptions {
  path: string;
  basemaps: boolean; // only basemaps
  current?: MapLayerOptions;
}

export function getLayerEditor(opts: LayerEditorOptions): NestedPanelOptions<MapLayerOptions> {
  return {
    category: ['Data layer XXXXX'],
    path: opts.path,
    defaultValue: opts.basemaps ? DEFAULT_BASEMAP_CONFIG : defaultMarkersConfig,
    values: (parent: NestedValueAccess) => ({
      getValue: (path: string) => parent.getValue(`${opts.path}.${path}`),
      onChange: (path: string, value: any) => {
        if (path === 'type' && value) {
          const layer = geomapLayerRegistry.getIfExists(value);
          if (layer) {
            parent.onChange(opts.path, {
              ...opts.current, // keep current shared options
              type: layer.id,
              config: { ...layer.defaultOptions }, // clone?
            });
            return; // reset current values
          }
        }
        parent.onChange(`${opts.path}.${path}`, value);
      },
    }),
    build: (builder, context) => {
      const { options } = context;
      const layer = geomapLayerRegistry.getIfExists(options?.type);

      const layerTypes = geomapLayerRegistry.selectOptions(
        options?.type // the selected value
          ? [options.type] // as an array
          : [DEFAULT_BASEMAP_CONFIG.type]
        //filter
      );

      builder.addSelect({
        path: 'type',
        name: 'Layer type',
        settings: {
          options: layerTypes.options,
        },
      });

      if (layer) {
        if (layer.showLocation) {
          builder
            .addRadio({
              path: 'location.mode',
              name: 'Location',
              description: '',
              defaultValue: FrameGeometrySourceMode.Auto,
              settings: {
                options: [
                  { value: FrameGeometrySourceMode.Auto, label: 'Auto' },
                  { value: FrameGeometrySourceMode.Coords, label: 'Coords' },
                  { value: FrameGeometrySourceMode.Geohash, label: 'Geohash' },
                  { value: FrameGeometrySourceMode.Lookup, label: 'Lookup' },
                ],
              },
            })
            .addFieldNamePicker({
              path: 'location.latitude',
              name: 'Latitude field',
              settings: {
                filter: (f: Field) => f.type === FieldType.number,
                noFieldsMessage: 'No numeric fields found',
              },
              showIf: (opts) => opts.location?.mode === FrameGeometrySourceMode.Coords,
            })
            .addFieldNamePicker({
              path: 'location.longitude',
              name: 'Longitude field',
              settings: {
                filter: (f: Field) => f.type === FieldType.number,
                noFieldsMessage: 'No numeric fields found',
              },
              showIf: (opts) => opts.location?.mode === FrameGeometrySourceMode.Coords,
            })
            .addFieldNamePicker({
              path: 'location.geohash',
              name: 'Geohash field',
              settings: {
                filter: (f: Field) => f.type === FieldType.string,
                noFieldsMessage: 'No strings fields found',
              },
              showIf: (opts) => opts.location?.mode === FrameGeometrySourceMode.Geohash,
              // eslint-disable-next-line react/display-name
              // info: (props) => <div>HELLO</div>,
            })
            .addFieldNamePicker({
              path: 'location.lookup',
              name: 'Lookup field',
              settings: {
                filter: (f: Field) => f.type === FieldType.string,
                noFieldsMessage: 'No strings fields found',
              },
              showIf: (opts) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
            })
            .addCustomEditor({
              id: 'gazetteer',
              path: 'location.gazetteer',
              name: 'Gazetteer',
              editor: GazetteerPathEditor,
              showIf: (opts) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
            });
        }
        if (layer.registerOptionsUI) {
          layer.registerOptionsUI(builder);
        }
        if (layer.showOpacity) {
          // TODO -- add opacity check
        }
      }

      console.log('GET SUB OPTIONS', { ...context });
      builder.addBooleanSwitch({
        category: ['subsub'],
        path: 'switchA',
        name: 'Switch A',
        defaultValue: true,
      });
      builder.addBooleanSwitch({
        category: ['subsub'],
        path: 'switchB',
        name: 'Switch B',
        defaultValue: true,
      });
    },
  };
}

export const LayerEditor: FC<LayerEditorProps> = ({ options, onChange, data, filter }) => {
  // all basemaps
  const layerTypes = useMemo(() => {
    return geomapLayerRegistry.selectOptions(
      options?.type // the selected value
        ? [options.type] // as an array
        : [DEFAULT_BASEMAP_CONFIG.type],
      filter
    );
  }, [options?.type, filter]);

  // The options change with each layer type
  const optionsEditorBuilder = useMemo(() => {
    const layer = geomapLayerRegistry.getIfExists(options?.type);
    if (!layer || !(layer.registerOptionsUI || layer.showLocation || layer.showOpacity)) {
      return null;
    }

    const builder = new PanelOptionsEditorBuilder<MapLayerOptions>();
    return builder;
  }, [options?.type]);

  // The react componnets
  const layerOptions = useMemo(() => {
    const layer = geomapLayerRegistry.getIfExists(options?.type);
    if (!optionsEditorBuilder || !layer) {
      return null;
    }

    const category = new OptionsPaneCategoryDescriptor({
      id: 'Layer config',
      title: 'Layer config',
    });

    const context: StandardEditorContext<any> = {
      data,
      options: options,
    };

    const currentOptions = { ...options, type: layer.id, config: { ...layer.defaultOptions, ...options?.config } };

    // Update the panel options if not set
    if (!options || (layer.defaultOptions && !options.config)) {
      onChange(currentOptions as any);
    }

    // const reg = optionsEditorBuilder.getRegistry();

    // // Load the options into categories
    // fillOptionsPaneItems(
    //   reg.list(),

    //   // Always use the same category
    //   (categoryNames) => category,

    //   // Custom upate function
    //   (path: string, value: any) => {
    //     onChange(setOptionImmutably(currentOptions, path, value) as any);
    //   },
    //   context
    // );

    return (
      <>
        <br />
        {category.items.map((item) => item.render())}
      </>
    );
  }, [optionsEditorBuilder, onChange, data, options]);

  return (
    <div>
      <Select
        menuShouldPortal
        options={layerTypes.options}
        value={layerTypes.current}
        onChange={(v) => {
          const layer = geomapLayerRegistry.getIfExists(v.value);
          if (!layer) {
            console.warn('layer does not exist', v);
            return;
          }

          onChange({
            ...options, // keep current options
            type: layer.id,
            config: { ...layer.defaultOptions }, // clone?
          });
        }}
      />

      {layerOptions}
    </div>
  );
};
