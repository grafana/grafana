import { getTemplateVariableOptions } from './getTemplateVariableOptions';
export function withTemplateVariableOptions(optionsPromise, wrapper, filter) {
    let templateVariableOptions = getTemplateVariableOptions(wrapper);
    if (filter) {
        templateVariableOptions = templateVariableOptions.filter((tvo) => tvo.indexOf(filter) > -1);
    }
    return optionsPromise.then((options) => [...templateVariableOptions, ...options]);
}
//# sourceMappingURL=withTemplateVariableOptions.js.map