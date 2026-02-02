import { SelectableValue } from '@grafana/data';
import { OptimizeVariable } from 'app/features/dashboard-scene/bmc/variables/optimize/OptimizeVariable';

import { VariableSelectField } from '../components/VariableSelectField';

interface OptimizeVariableEditorProps {
  variable: OptimizeVariable;
}

export function OptimizeVariableEditor({ variable }: OptimizeVariableEditorProps) {
  const OPTIONS = [{ label: 'Domain filter', value: 'domain-filter' }];
  return (
    <>
      <VariableSelectField
        name="Select optimize variable type"
        options={OPTIONS}
        value={OPTIONS[0]}
        onChange={(option: SelectableValue<string>) => {}}
      />
    </>
  );
}
