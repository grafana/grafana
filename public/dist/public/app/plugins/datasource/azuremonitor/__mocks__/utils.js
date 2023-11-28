export function createTemplateVariables(templateableProps, value = '') {
    const templateVariables = new Map();
    templateableProps.map((prop) => {
        const variableName = prop.replace(/[\[\].]/g, '');
        const templateVariable = {
            current: {
                selected: false,
                text: `${variableName}-template-variable`,
                value: value === '' ? `${variableName}-template-variable` : value,
            },
            id: variableName,
            name: variableName,
            type: 'textbox',
            options: [],
            query: '',
            rootStateKey: null,
            global: false,
            hide: 0,
            skipUrlSync: false,
            index: 0,
            state: 'Done',
            error: null,
            description: null,
        };
        templateVariables.set(prop, {
            variableName,
            templateVariable,
        });
    });
    return templateVariables;
}
export function mapPartialArrayObject(defaultValue, arr) {
    if (!arr) {
        return [defaultValue];
    }
    return arr.map((item) => {
        if (!item) {
            return defaultValue;
        }
        return Object.assign(Object.assign({}, item), defaultValue);
    });
}
//# sourceMappingURL=utils.js.map