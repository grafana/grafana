import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';

import { LOG_GROUP_ACCOUNT_MAX } from '../../../utils/logGroupsConstants';

export interface AccountsSelectorProps {
  onChange: (accountIds: string[]) => void;
  accountOptions: Array<SelectableValue<string>>;
  selectedAccountIds?: string[];
  disabled?: boolean;
}

export function AccountsSelector({
  selectedAccountIds = [],
  onChange,
  accountOptions,
  disabled,
}: AccountsSelectorProps) {
  if (accountOptions.length === 0) {
    return null;
  }

  return (
    <EditorField
      label="Accounts"
      width={50}
      tooltip={`Select accounts to include in the query (max ${LOG_GROUP_ACCOUNT_MAX}). Leave empty to query all accounts. A CloudWatch monitoring account views data from source accounts.`}
    >
      <MultiSelect
        aria-label="Account Selection"
        value={selectedAccountIds}
        options={accountOptions}
        onChange={(selected) => {
          const accountIds = selected.filter(({ value }) => value).map(({ value }) => value!);
          onChange(accountIds);
        }}
        closeMenuOnSelect={false}
        isClearable
        isOptionDisabled={() => selectedAccountIds.length >= LOG_GROUP_ACCOUNT_MAX}
        placeholder="All accounts"
        disabled={disabled}
      />
    </EditorField>
  );
}
