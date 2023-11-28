import { getTemplateSrv } from '@grafana/runtime/src';
export function getTemplateVariableOptions(wrapper) {
    return (getTemplateSrv()
        .getVariables()
        // we make them regex-params, i'm not 100% sure why.
        // probably because this way multi-value variables work ok too.
        .map(wrapper));
}
//# sourceMappingURL=getTemplateVariableOptions.js.map