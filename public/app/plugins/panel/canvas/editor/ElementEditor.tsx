import React, { FC, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { DataFrame, PanelOptionsEditorBuilder, StandardEditorContext } from '@grafana/data';
import { CanvasElementItem, CanvasElementOptions } from '../base';
import { canvasElementRegistry, DEFAULT_ELEMENT_CONFIG } from '../elements/registry';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVizualizationOptions';
import { ColorDimensionEditor } from '../../../../features/dimensions/editors/ColorDimensionEditor';

export interface CanvasElementEditorProps<TConfig = any> {
  options?: CanvasElementOptions<TConfig>;
  data: DataFrame[]; // All results
  onChange: (options: CanvasElementOptions<TConfig>) => void;
  filter?: (item: CanvasElementItem) => boolean;
}

export const CanvasElementEditor: FC<CanvasElementEditorProps> = ({ options, onChange, data, filter }) => {
  // all basemaps
  const layerTypes = useMemo(() => {
    return canvasElementRegistry.selectOptions(
      options?.type // the selected value
        ? [options.type] // as an array
        : [DEFAULT_ELEMENT_CONFIG.type],
      filter
    );
  }, [options?.type, filter]);

  // The options change with each layer type
  const optionsEditorBuilder = useMemo(() => {
    const layer = canvasElementRegistry.getIfExists(options?.type);
    if (!layer || !layer.registerOptionsUI) {
      return null;
    }

    const builder = new PanelOptionsEditorBuilder<CanvasElementOptions>();
    // if (layer.showLocation) {
    //   builder
    //     .addRadio({
    //       path: 'location.mode',
    //       name: 'Location',
    //       description: '',
    //       defaultValue: FrameGeometrySourceMode.Auto,
    //       settings: {
    //         options: [
    //           { value: FrameGeometrySourceMode.Auto, label: 'Auto' },
    //           { value: FrameGeometrySourceMode.Coords, label: 'Coords' },
    //           { value: FrameGeometrySourceMode.Geohash, label: 'Geohash' },
    //           { value: FrameGeometrySourceMode.Lookup, label: 'Lookup' },
    //         ],
    //       },
    //     })
    //     .addFieldNamePicker({
    //       path: 'location.latitude',
    //       name: 'Latitude Field',
    //       settings: {
    //         filter: (f: Field) => f.type === FieldType.number,
    //         noFieldsMessage: 'No numeric fields found',
    //       },
    //       showIf: (opts: MapCanvasElementOptions) => opts.location?.mode === FrameGeometrySourceMode.Coords,
    //     })
    //     .addFieldNamePicker({
    //       path: 'location.longitude',
    //       name: 'Longitude Field',
    //       settings: {
    //         filter: (f: Field) => f.type === FieldType.number,
    //         noFieldsMessage: 'No numeric fields found',
    //       },
    //       showIf: (opts: MapCanvasElementOptions) => opts.location?.mode === FrameGeometrySourceMode.Coords,
    //     })
    //     .addFieldNamePicker({
    //       path: 'location.geohash',
    //       name: 'Geohash Field',
    //       settings: {
    //         filter: (f: Field) => f.type === FieldType.string,
    //         noFieldsMessage: 'No strings fields found',
    //       },
    //       showIf: (opts: MapCanvasElementOptions) => opts.location?.mode === FrameGeometrySourceMode.Geohash,
    //       // eslint-disable-next-line react/display-name
    //       // info: (props) => <div>HELLO</div>,
    //     })
    //     .addFieldNamePicker({
    //       path: 'location.lookup',
    //       name: 'Lookup Field',
    //       settings: {
    //         filter: (f: Field) => f.type === FieldType.string,
    //         noFieldsMessage: 'No strings fields found',
    //       },
    //       showIf: (opts: MapCanvasElementOptions) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
    //     })
    //     .addCustomEditor({
    //       id: 'gazetteer',
    //       path: 'location.gazetteer',
    //       name: 'Gazetteer',
    //       editor: GazetteerPathEditor,
    //       showIf: (opts: MapCanvasElementOptions) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
    //     });
    // }
    if (layer.registerOptionsUI) {
      layer.registerOptionsUI(builder);
    }

    // export interface BackgroundConfig {
    //   color?: ColorDimensionConfig;
    //   image?: string;
    //   // repeat // https://developer.mozilla.org/en-US/docs/Web/CSS/background-repeat
    //   // position ?
    // }

    // export interface LineConfig {
    //   color?: ColorDimensionConfig;
    //   width?: number;
    // }

    builder.addCustomEditor({
      id: 'background.color',
      path: 'background.color',
      name: 'Background Color',
      editor: ColorDimensionEditor,
      settings: {},
      defaultValue: {
        // Configured values
        fixed: '',
      },
    });

    builder.addSliderInput({
      path: 'border.width',
      name: 'Border Width',
      defaultValue: 2,
      settings: {
        min: 0,
        max: 20,
      },
    });

    builder.addCustomEditor({
      id: 'border.color',
      path: 'border.color',
      name: 'Border Color',
      editor: ColorDimensionEditor,
      settings: {},
      defaultValue: {
        // Configured values
        fixed: '',
      },
      showIf: (cfg) => Boolean(cfg.border?.width),
    });

    return builder;
  }, [options?.type]);

  // The react componnets
  const layerOptions = useMemo(() => {
    const layer = canvasElementRegistry.getIfExists(options?.type);
    if (!optionsEditorBuilder || !layer) {
      return null;
    }

    const category = new OptionsPaneCategoryDescriptor({
      id: 'CanvasElement config',
      title: 'CanvasElement config',
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

    const reg = optionsEditorBuilder.getRegistry();

    // Load the options into categories
    fillOptionsPaneItems(
      reg.list(),

      // Always use the same category
      (categoryNames) => category,

      // Custom upate function
      (path: string, value: any) => {
        onChange(setOptionImmutably(currentOptions, path, value) as any);
      },
      context
    );

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
        options={layerTypes.options}
        value={layerTypes.current}
        onChange={(v) => {
          const layer = canvasElementRegistry.getIfExists(v.value);
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
