import { type Field, FieldType, type PanelOptionsEditorBuilder, type DataFrame } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type FrameGeometrySource, FrameGeometrySourceMode } from '@grafana/schema';
import { GazetteerPathEditor } from 'app/features/geo/editor/GazetteerPathEditor';

import { LocationModeEditor } from './locationModeEditor';

export function addLocationFields<TOptions>(
  title: string,
  prefix: string,
  builder: PanelOptionsEditorBuilder<TOptions>, // ??? Perhaps pass in the filtered data?
  source?: FrameGeometrySource,
  data?: DataFrame[],
  /** Restrict the selectable modes. When exactly one mode is given, it's implied and no mode picker is shown. */
  modes?: FrameGeometrySourceMode[]
) {
  const impliedMode = modes?.length === 1 ? modes[0] : undefined;

  if (!impliedMode) {
    builder.addCustomEditor({
      id: 'modeEditor',
      path: `${prefix}mode`,
      name: t('geo.location-editor.name-location-mode', 'Location Mode'),
      editor: LocationModeEditor,
      settings: { data, source, modes },
    });
  }

  // TODO apply data filter to field pickers
  switch (impliedMode ?? source?.mode) {
    case FrameGeometrySourceMode.Coords:
      builder
        .addFieldNamePicker({
          path: `${prefix}latitude`,
          name: t('geo.location-editor.name-latitude-field', 'Latitude field'),
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: t('geo.location-editor.latitude-field.no-fields-message', 'No numeric fields found'),
          },
        })
        .addFieldNamePicker({
          path: `${prefix}longitude`,
          name: t('geo.location-editor.name-longitude-field', 'Longitude field'),
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: t('geo.location-editor.longitude-field.no-fields-message', 'No numeric fields found'),
          },
        });
      break;

    case FrameGeometrySourceMode.Geohash:
      builder.addFieldNamePicker({
        path: `${prefix}geohash`,
        name: t('geo.location-editor.name-geohash-field', 'Geohash field'),
        settings: {
          filter: (f: Field) => f.type === FieldType.string,
          noFieldsMessage: t('geo.location-editor.geohash-field.no-fields-message', 'No strings fields found'),
        },
      });
      break;

    case FrameGeometrySourceMode.Lookup:
      builder
        .addFieldNamePicker({
          path: `${prefix}lookup`,
          name: t('geo.location-editor.name-lookup-field', 'Lookup field'),
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: t('geo.location-editor.lookup-field.no-fields-message', 'No strings fields found'),
          },
        })
        .addCustomEditor({
          id: 'gazetteer',
          path: `${prefix}gazetteer`,
          name: t('geo.location-editor.name-gazetteer', 'Gazetteer'),
          editor: GazetteerPathEditor,
        });
      break;

    case FrameGeometrySourceMode.Wkt:
      builder.addFieldNamePicker({
        path: `${prefix}wkt`,
        name: t('geo.location-editor.name-wkt-field', 'WKT field'),
        settings: {
          filter: (f: Field) => f.type === FieldType.string,
          noFieldsMessage: t('geo.location-editor.wkt-field.no-fields-message', 'No strings fields found'),
        },
      });
      break;
  }
}
