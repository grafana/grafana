import { type VariableCompletionOptions } from '@grafana/ui';

export const variableCompletionOptions: VariableCompletionOptions = {
  toDisplay: (suggestion) => ({
    label: `\${${suggestion.value}}`,
    detail: suggestion.value === suggestion.label ? suggestion.origin : `${suggestion.label} / ${suggestion.origin}`,
  }),
};
