import { LoadingState } from '@grafana/data/src/types/data';
import { VariableWithOptions } from 'app/features/variables/types';

interface TemplateableValue {
  variableName: string;
  templateVariable: VariableWithOptions;
}

export function createTemplateVariables(templateableProps: string[]): Map<string, TemplateableValue> {
  const templateVariables = new Map<string, TemplateableValue>();
  templateableProps.map((prop) => {
    const variableName = prop.replace(/[\[\].]/g, '');
    const templateVariable = {
      current: {
        selected: false,
        text: `${variableName}-template-variable`,
        value: `${variableName}-template-variable`,
      },
      id: variableName,
      name: variableName,
      type: 'textbox' as 'textbox',
      options: [],
      query: '',
      rootStateKey: null,
      global: false,
      hide: 0,
      skipUrlSync: false,
      index: 0,
      state: LoadingState.Done,
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
