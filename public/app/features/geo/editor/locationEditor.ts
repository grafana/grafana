import {
  Field,
  FieldType,
  FrameGeometrySource,
  FrameGeometrySourceMode,
  PanelOptionsEditorBuilder,
  DataFrame,
} from '@grafana/data';
import { GazetteerPathEditor } from 'app/features/geo/editor/GazetteerPathEditor';

import { getGeometryField, getLocationMatchers } from '../utils/location';

import { LocationModeEditor } from './locationModeEditor';

export function addLocationFields<TOptions>(
  title: string,
  prefix: string,
  builder: PanelOptionsEditorBuilder<TOptions>, // ??? Perhaps pass in the filtered data?
  source?: FrameGeometrySource,
  data?: DataFrame[]
) {
  if (source && data?.length) {
    // TODO... equivolent in the custom component
    // TODO show errors but also current state if auto (for transparency)
    getLocationMatchers(source).then((location) => {
      const info = getGeometryField(data[0], location);
      console.log('LOCATION', info);
    });
  }

  // TODO replace radio with custom component
  builder.addCustomEditor({
    id: 'modeEditor',
    path: `${prefix}mode`,
    name: 'Location',
    editor: LocationModeEditor,
  });

  // TODO apply data filter to field pickers
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
