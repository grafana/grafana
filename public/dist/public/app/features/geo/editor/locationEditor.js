import { FieldType } from '@grafana/data';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { GazetteerPathEditor } from 'app/features/geo/editor/GazetteerPathEditor';
import { LocationModeEditor } from './locationModeEditor';
export function addLocationFields(title, prefix, builder, // ??? Perhaps pass in the filtered data?
source, data) {
    builder.addCustomEditor({
        id: 'modeEditor',
        path: `${prefix}mode`,
        name: 'Location Mode',
        editor: LocationModeEditor,
        settings: { data, source },
    });
    // TODO apply data filter to field pickers
    switch (source === null || source === void 0 ? void 0 : source.mode) {
        case FrameGeometrySourceMode.Coords:
            builder
                .addFieldNamePicker({
                path: `${prefix}latitude`,
                name: 'Latitude field',
                settings: {
                    filter: (f) => f.type === FieldType.number,
                    noFieldsMessage: 'No numeric fields found',
                },
            })
                .addFieldNamePicker({
                path: `${prefix}longitude`,
                name: 'Longitude field',
                settings: {
                    filter: (f) => f.type === FieldType.number,
                    noFieldsMessage: 'No numeric fields found',
                },
            });
            break;
        case FrameGeometrySourceMode.Geohash:
            builder.addFieldNamePicker({
                path: `${prefix}geohash`,
                name: 'Geohash field',
                settings: {
                    filter: (f) => f.type === FieldType.string,
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
                    filter: (f) => f.type === FieldType.string,
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
//# sourceMappingURL=locationEditor.js.map