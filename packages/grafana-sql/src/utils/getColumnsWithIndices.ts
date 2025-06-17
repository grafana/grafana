import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { SQLQuery } from '../types';

export function getColumnsWithIndices(query: SQLQuery, fields: SelectableValue[]): SelectableValue[] {
  if (!fields || !query.sql?.columns) {
    return fields;
  }

  const options = query.sql.columns.map((c, i) => {
    const value = c.name
      ? `${c.name}(${c.parameters?.map((p) => p.name).join(', ')})`
      : c.parameters?.map((p) => p.name).join(', ');
    return {
      value,
      label: `${i + 1} - ${value}`,
    };
  });

  return [
    {
      value: '',
      label: t('grafana-sql.utils.get-columns-width-indices.label-selected-columns', 'Selected columns'),
      options,
      expanded: true,
    },
    ...fields,
  ];
}
