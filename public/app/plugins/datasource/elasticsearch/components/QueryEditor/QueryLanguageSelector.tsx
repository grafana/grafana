import { Combobox, ComboboxOption } from '@grafana/ui';

import { QueryType } from '../../dataquery.gen';

const OPTIONS: Array<ComboboxOption<QueryType>> = [
  { value: 'dsl', label: 'DSL' },
  { value: 'esql', label: 'ES|QL' },
];

interface Props {
  value: QueryType;
  onChange: (queryType: QueryType) => void;
}

export const QueryLanguageSelector = ({ value, onChange }: Props) => {
  return (
    <Combobox<QueryType>
      data-testid="elasticsearch-query-language-toggle"
      options={OPTIONS}
      value={value}
      width={16}
      onChange={(option) => option?.value != null && onChange(option.value)}
    />
  );
};
