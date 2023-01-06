import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';

export interface Props {
  onChange: (accountId?: string) => void;
  accountOptions: Array<SelectableValue<string>>;
  accountId?: string;
}

export const ALL_ACCOUNTS_OPTION = {
  label: 'All',
  value: 'all',
  description: 'Target all linked accounts',
};

export function Account({ accountId, onChange, accountOptions }: Props) {
  const selectedAccountExistsInOptions = useMemo(
    () =>
      accountOptions.find((a) => {
        if (a.options) {
          const matchingTemplateVar = a.options.find((tempVar: SelectableValue<string>) => {
            return tempVar.value === accountId;
          });
          return matchingTemplateVar;
        }
        return a.value === accountId;
      }),
    [accountOptions, accountId]
  );

  if (accountOptions.length === 0) {
    return null;
  }

  return (
    <EditorField
      label="Account"
      width={26}
      tooltip="A CloudWatch monitoring account views data from source accounts so you can centralize monitoring and troubleshooting activities across multiple accounts. Go to the CloudWatch settings page in the AWS console for more details."
    >
      <Select
        aria-label="Account Selection"
        value={selectedAccountExistsInOptions ? accountId : ALL_ACCOUNTS_OPTION.value}
        options={[ALL_ACCOUNTS_OPTION, ...accountOptions]}
        onChange={({ value }) => {
          onChange(value);
        }}
      />
    </EditorField>
  );
}
