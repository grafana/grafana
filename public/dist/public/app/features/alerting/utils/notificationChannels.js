import { __assign, __read } from "tslib";
import memoizeOne from 'memoize-one';
import { config } from '@grafana/runtime';
export var defaultValues = {
    id: -1,
    name: '',
    type: { value: 'email', label: 'Email' },
    sendReminder: false,
    disableResolveMessage: false,
    frequency: '15m',
    settings: {
        uploadImage: config.rendererAvailable,
        autoResolve: true,
        httpMethod: 'POST',
        severity: 'critical',
    },
    secureSettings: {},
    secureFields: {},
    isDefault: false,
};
export var mapChannelsToSelectableValue = memoizeOne(function (notificationChannels, includeDescription) {
    return notificationChannels.map(function (channel) {
        if (includeDescription) {
            return {
                value: channel.value,
                label: channel.label,
                description: channel.description,
            };
        }
        return {
            value: channel.value,
            label: channel.label,
        };
    });
});
export var transformSubmitData = function (formData) {
    /*
      Some settings can be options in a select, in order to not save a SelectableValue<T>
      we need to use check if it is a SelectableValue and use its value.
    */
    var settings = Object.fromEntries(Object.entries(formData.settings).map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        return [key, value && value.hasOwnProperty('value') ? value.value : value];
    }));
    return __assign(__assign(__assign({}, defaultValues), formData), { frequency: formData.frequency === '' ? defaultValues.frequency : formData.frequency, type: formData.type.value, settings: __assign(__assign({}, defaultValues.settings), settings), secureSettings: __assign({}, formData.secureSettings) });
};
export var transformTestData = function (formData) {
    var _a;
    return {
        name: formData.name,
        type: formData.type.value,
        frequency: (_a = formData.frequency) !== null && _a !== void 0 ? _a : defaultValues.frequency,
        settings: __assign({}, Object.assign(defaultValues.settings, formData.settings)),
        secureSettings: __assign({}, formData.secureSettings),
    };
};
//# sourceMappingURL=notificationChannels.js.map