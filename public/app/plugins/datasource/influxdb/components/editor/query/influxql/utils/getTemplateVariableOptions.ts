import { TypedVariableModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

export function getTemplateVariableOptions(wrapper: (v: TypedVariableModel) => string) {
  return (
    getTemplateSrv()
      .getVariables()
      // we make them regex-params, i'm not 100% sure why.
      // probably because this way multi-value variables work ok too.
      .map(wrapper)
  );
}
