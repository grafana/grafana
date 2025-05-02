import { FilterInput, InlineField } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props {
  searchQuery: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
}

export const ApiKeysActionBar = ({ searchQuery, disabled, onSearchChange }: Props) => {
  return (
    <div className="page-action-bar">
      <InlineField grow>
        <FilterInput
          placeholder={t('api-keys.api-keys-action-bar.placeholder-search-keys', 'Search keys')}
          value={searchQuery}
          onChange={onSearchChange}
        />
      </InlineField>
    </div>
  );
};
