import memoizeOne from 'memoize-one';
import { config } from '@grafana/runtime';
export const defaultValues = {
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
export const mapChannelsToSelectableValue = memoizeOne((notificationChannels, includeDescription) => {
    return notificationChannels.map((channel) => {
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
export const transformSubmitData = (formData) => {
    /*
      Some settings can be options in a select, in order to not save a SelectableValue<T>
      we need to use check if it is a SelectableValue and use its value.
    */
    const settings = Object.fromEntries(Object.entries(formData.settings).map(([key, value]) => {
        return [key, value && value.hasOwnProperty('value') ? value.value : value];
    }));
    return Object.assign(Object.assign(Object.assign({}, defaultValues), formData), { frequency: formData.frequency === '' ? defaultValues.frequency : formData.frequency, type: formData.type.value, settings: Object.assign(Object.assign({}, defaultValues.settings), settings), secureSettings: Object.assign({}, formData.secureSettings) });
};
export const transformTestData = (formData) => {
    var _a;
    return {
        name: formData.name,
        type: formData.type.value,
        frequency: (_a = formData.frequency) !== null && _a !== void 0 ? _a : defaultValues.frequency,
        settings: Object.assign({}, Object.assign(defaultValues.settings, formData.settings)),
        secureSettings: Object.assign({}, formData.secureSettings),
    };
};
//# sourceMappingURL=notificationChannels.js.map