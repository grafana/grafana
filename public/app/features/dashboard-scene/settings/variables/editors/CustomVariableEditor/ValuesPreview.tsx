import { CustomVariable } from '@grafana/scenes';

import { VariableValuesPreview } from '../../components/VariableValuesPreview';
import { hasVariableOptions } from '../../utils';

export function ValuesPreview({ variable }: { variable: CustomVariable }) {
  // Workaround to toggle a component refresh when values change so that the preview is updated
  variable.useState();

  const isHasVariableOptions = hasVariableOptions(variable);

  return isHasVariableOptions ? <VariableValuesPreview options={variable.getOptionsForSelect(false)} /> : null;
}
