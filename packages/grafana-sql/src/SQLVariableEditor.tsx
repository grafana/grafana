import { useEffect, useState } from 'react';

import { QueryEditorProps, DataQueryRequest, Field } from '@grafana/data';
import { t } from '@grafana/i18n';
import { EditorRows, EditorRow, EditorField } from '@grafana/plugin-ui';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { migrateVariableQuery } from './SQLVariableUtils';
import { SqlQueryEditorLazy } from './components/QueryEditorLazy';
import { SqlDatasource } from './datasource/SqlDatasource';
import { type SQLQuery, type SQLOptions, type SQLQueryMeta } from './types';

type SQLVariableQueryEditorProps = QueryEditorProps<SqlDatasource, SQLQuery, SQLOptions>;

export const SQLVariablesQueryEditor = (props: SQLVariableQueryEditorProps) => {
  const query = migrateVariableQuery(props.query);
  return (
    <>
      <SqlQueryEditorLazy {...props} query={query} />
      <FieldMapping {...props} query={query} />
    </>
  );
};

const FieldMapping = (props: SQLVariableQueryEditorProps) => {
  const { query, datasource, onChange } = props;
  const [choices, setChoices] = useState<ComboboxOption[]>([]);
  useEffect(() => {
    let isActive = true;
    // eslint-disable-next-line
    const subscription = datasource.query({ targets: [query] } as DataQueryRequest<SQLQuery>).subscribe({
      next: (response) => {
        if (!isActive) {
          return;
        }
        const fieldNames = (response.data[0] || { fields: [] }).fields.map((f: Field) => f.name);
        setChoices(fieldNames.map((f: Field) => ({ value: f, label: f })));
      },
      error: () => {
        if (isActive) {
          setChoices([]);
        }
      },
    });
    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [datasource, query]);
  const onMetaPropChange = <Key extends keyof SQLQueryMeta, Value extends SQLQueryMeta[Key]>(
    key: Key,
    value: Value,
    meta = query.meta || {}
  ) => {
    onChange({ ...query, meta: { ...meta, [key]: value } });
  };
  return (
    <EditorRows>
      <EditorRow>
        <EditorField label={t('grafana-sql.components.query-meta.variables.valueField', 'Value Field')}>
          <Combobox
            isClearable
            value={query.meta?.valueField}
            onChange={(e) => onMetaPropChange('valueField', e?.value)}
            width={40}
            options={choices}
          />
        </EditorField>
        <EditorField label={t('grafana-sql.components.query-meta.variables.textField', 'Text Field')}>
          <Combobox
            isClearable
            value={query.meta?.textField}
            onChange={(e) => onMetaPropChange('textField', e?.value)}
            width={40}
            options={choices}
          />
        </EditorField>
      </EditorRow>
    </EditorRows>
  );
};
