import { OptimizeVariableModel } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { OptimizeVariablePickerUnconnected } from 'app/features/variables/optimize/OptimizeVariablePicker';

import { OptimizeVariable } from './OptimizeVariable';

export function OptimizeVariableInput({ model }: SceneComponentProps<OptimizeVariable>) {
  const optimizeVariableState = model.useState();
  return (
    <OptimizeVariablePickerUnconnected
      variable={optimizeVariableState as unknown as OptimizeVariableModel}
      filterondescendant={optimizeVariableState.filterondescendant}
      readOnly={false}
    />
  );
}
