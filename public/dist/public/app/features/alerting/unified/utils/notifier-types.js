export function option(propertyName, label, description, rest = {}) {
    return Object.assign({ propertyName,
        label,
        description, element: 'input', inputType: '', required: false, secure: false, placeholder: '', validationRule: '', showWhen: { field: '', is: '' }, dependsOn: '' }, rest);
}
//# sourceMappingURL=notifier-types.js.map