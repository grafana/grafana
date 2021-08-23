import { MapLayerOptions, PanelOptionsEditorBuilder, FrameGeometrySourceMode, FieldType, Field } from '@grafana/data';
import { defaultBaseLayer, DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { GazetteerPathEditor } from './GazetteerPathEditor';
import { LayerPickerEditor } from './LayerPickerEditor';
import { OptionsEditorPathValue } from '../../../../../../packages/grafana-data/src/types/options';

let uniqueID = 1;

export function addMapLayerEditors(
  builder: PanelOptionsEditorBuilder<any>,
  opts: MapLayerOptions,
  onlyBasemaps: boolean,
  onTypeChanged: (v: MapLayerOptions) => OptionsEditorPathValue
) {
  // Layer type channged
  builder.addCustomEditor({
    id: `map-type-${uniqueID++}`,
    path: 'type',
    name: 'Layer type',
    editor: LayerPickerEditor,
    beforeChange: ({ value }) => {
      const layer = geomapLayerRegistry.getIfExists(value);
      if (!layer) {
        console.warn('layer does not exist', value);
        return {} as any; // noop
      }
      return onTypeChanged({
        ...opts,
        type: layer?.id,
        config: { ...layer.defaultOptions }, // clone?
      });
    },
    settings: {
      onlyBasemaps,
    },
    defaultValue: DEFAULT_BASEMAP_CONFIG.type,
  });

  const layer = geomapLayerRegistry.getIfExists(opts.type) ?? defaultBaseLayer;
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
        name: 'Latitude Field',
        settings: {
          filter: (f: Field) => f.type === FieldType.number,
          noFieldsMessage: 'No numeric fields found',
        },
        showIf: (opts) => opts.location?.mode === FrameGeometrySourceMode.Coords,
      })
      .addFieldNamePicker({
        path: 'location.longitude',
        name: 'Longitude Field',
        settings: {
          filter: (f: Field) => f.type === FieldType.number,
          noFieldsMessage: 'No numeric fields found',
        },
        showIf: (opts) => opts.location?.mode === FrameGeometrySourceMode.Coords,
      })
      .addFieldNamePicker({
        path: 'location.geohash',
        name: 'Geohash Field',
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
        name: 'Lookup Field',
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
