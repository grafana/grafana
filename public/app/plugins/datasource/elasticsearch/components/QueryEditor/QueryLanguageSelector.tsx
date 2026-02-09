import { Combobox, ComboboxOption } from '@grafana/ui';

import { QueryLanguage } from '../../types';

const OPTIONS: Array<ComboboxOption<QueryLanguage>> = [
  { value: 'raw_dsl', label: 'DSL' },
  { value: 'esql', label: 'ES|QL' },
];

interface Props {
  value: QueryLanguage;
  onChange: (queryLanguage: QueryLanguage) => void;
}

export const QueryLanguageSelector = ({ value, onChange }: Props) => {
  return (
    <Combobox<QueryLanguage>
      data-testid="elasticsearch-query-language-toggle"
      options={OPTIONS}
      value={value}
      width={16}
      onChange={(option) => option?.value != null && onChange(option.value)}
    />
  );
};
