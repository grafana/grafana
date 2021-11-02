import { stylesFactory } from '../../themes';
import { getLabelStyles } from './Label';
import { getLegendStyles } from './Legend';
import { getFieldValidationMessageStyles } from './FieldValidationMessage';
import { getButtonStyles } from '../Button';
import { getInputStyles } from '../Input/Input';
import { getCheckboxStyles } from './Checkbox';
/** @deprecated */
export var getFormStyles = stylesFactory(function (theme, options) {
    console.warn('getFormStyles is deprecated');
    return {
        label: getLabelStyles(theme),
        legend: getLegendStyles(theme.v1),
        fieldValidationMessage: getFieldValidationMessageStyles(theme),
        button: getButtonStyles({
            theme: theme,
            variant: options.variant,
            size: options.size,
        }),
        input: getInputStyles({ theme: theme, invalid: options.invalid }),
        checkbox: getCheckboxStyles(theme),
    };
});
//# sourceMappingURL=getFormStyles.js.map