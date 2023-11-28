import { availableIconsIndex, FieldType } from '@grafana/data';
export { toIconName } from '@grafana/data';
// function remains for backwards compatibility
export const getAvailableIcons = () => Object.keys(availableIconsIndex);
/**
 * Get the icon for a given field
 */
export function getFieldTypeIcon(field) {
    return getFieldTypeIconName(field === null || field === void 0 ? void 0 : field.type);
}
/** Get an icon for a given field type  */
export function getFieldTypeIconName(type) {
    if (type) {
        switch (type) {
            case FieldType.time:
                return 'clock-nine';
            case FieldType.string:
                return 'font';
            case FieldType.number:
                return 'calculator-alt';
            case FieldType.boolean:
                return 'toggle-on';
            case FieldType.trace:
                return 'info-circle';
            case FieldType.enum:
                return 'list-ol';
            case FieldType.geo:
                return 'map-marker';
            case FieldType.other:
                return 'brackets-curly';
        }
    }
    return 'question-circle';
}
//# sourceMappingURL=icon.js.map