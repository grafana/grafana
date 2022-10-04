import {
  Field,
  FieldType,
  FrameGeometrySource,
  FrameGeometrySourceMode,
  PanelOptionsEditorBuilder,
  DataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors/src';
import { GazetteerPathEditor } from 'app/features/geo/editor/GazetteerPathEditor';

import { getGeometryField, getLocationMatchers } from '../utils/location';

export function addLocationFields<TOptions>(
  title: string,
  prefix: string,
  builder: PanelOptionsEditorBuilder<TOptions>, // ??? Perhaps pass in the filtered data?
  source?: FrameGeometrySource,
  data?: DataFrame[]
) {
  if (source && data?.length) {
    // TODO... equivolent in the custom component
    getLocationMatchers(source).then((location) => {
      const info = getGeometryField(data[0], location);
      console.log('LOCATION', info);
    });
  }

  // TODO replace radio with custom component
  builder.addRadio({
    path: `${prefix}mode`,
    name: title,
    description: '',
    defaultValue: FrameGeometrySourceMode.Auto,
    settings: {
      options: [
        {
          value: FrameGeometrySourceMode.Auto,
          label: 'Auto',
          ariaLabel: selectors.components.Transforms.SpatialOperations.location.autoOption,
        },
        {
          value: FrameGeometrySourceMode.Coords,
          label: 'Coords',
          ariaLabel: selectors.components.Transforms.SpatialOperations.location.coords.option,
        },
        {
          value: FrameGeometrySourceMode.Geohash,
          label: 'Geohash',
          ariaLabel: selectors.components.Transforms.SpatialOperations.location.geohash.option,
        },
        {
          value: FrameGeometrySourceMode.Lookup,
          label: 'Lookup',
          ariaLabel: selectors.components.Transforms.SpatialOperations.location.lookup.option,
        },
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
