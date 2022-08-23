import {
  Field,
  FieldType,
  FrameGeometrySource,
  FrameGeometrySourceMode,
  PanelOptionsEditorBuilder,
} from '@grafana/data';
import { GazetteerPathEditor } from 'app/features/geo/editor/GazetteerPathEditor';

export function addLocationFields<TOptions>(
  title: string,
  prefix: string,
  builder: PanelOptionsEditorBuilder<TOptions>,
  source?: FrameGeometrySource
) {
  builder.addRadio({
    path: `${prefix}mode`,
    name: title,
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
  });

  switch (source?.mode) {
    case FrameGeometrySourceMode.Coords:
      builder
        .addFieldNamePicker({
          path: `${prefix}latitude`,
          name: 'Latitude field',
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: 'No numeric fields found',
          },
        })
        .addFieldNamePicker({
          path: `${prefix}longitude`,
          name: 'Longitude field',
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: 'No numeric fields found',
          },
        });
      break;

    case FrameGeometrySourceMode.Geohash:
      builder.addFieldNamePicker({
        path: `${prefix}geohash`,
        name: 'Geohash field',
        settings: {
          filter: (f: Field) => f.type === FieldType.string,
          noFieldsMessage: 'No strings fields found',
        },
      });
      break;

    case FrameGeometrySourceMode.Lookup:
      builder
        .addFieldNamePicker({
          path: `${prefix}lookup`,
          name: 'Lookup field',
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: 'No strings fields found',
          },
        })
        .addCustomEditor({
          id: 'gazetteer',
          path: `${prefix}gazetteer`,
          name: 'Gazetteer',
          editor: GazetteerPathEditor,
        });
  }
}
