import { RadioButtonGroup } from '@grafana/ui';

import { LogsQueryScope } from '../../../dataquery.gen';

export interface LogGroupQueryScopeSelectorProps {
  value: LogsQueryScope | undefined;
  onChange: (scope: LogsQueryScope) => void;
  disabled?: boolean;
}

const queryScopeOptions = [
  { label: 'Log group name', value: 'logGroupName' as const },
  { label: 'Name prefix', value: 'namePrefix' as const },
  { label: 'All log groups', value: 'allLogGroups' as const },
];

export const LogGroupQueryScopeSelector = ({ value, onChange, disabled }: LogGroupQueryScopeSelectorProps) => {
  return (
    <RadioButtonGroup
      options={queryScopeOptions}
      value={value ?? 'logGroupName'}
      onChange={onChange}
      disabled={disabled}
      size="md"
    />
  );
};
