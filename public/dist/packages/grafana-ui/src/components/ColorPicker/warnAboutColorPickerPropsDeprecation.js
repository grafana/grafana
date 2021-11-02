import { deprecationWarning } from '@grafana/data';
export var warnAboutColorPickerPropsDeprecation = function (componentName, props) {
    var onColorChange = props.onColorChange;
    if (onColorChange) {
        deprecationWarning(componentName, 'onColorChange', 'onChange');
    }
};
//# sourceMappingURL=warnAboutColorPickerPropsDeprecation.js.map