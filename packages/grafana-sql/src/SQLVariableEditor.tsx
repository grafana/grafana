import { useEffect, useMemo, useRef, useState } from 'react';

import { DataQueryRequest, Field } from '@grafana/data';
import { t } from '@grafana/i18n';
import { EditorRows, EditorRow, EditorField } from '@grafana/plugin-ui';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { migrateVariableQuery } from './SQLVariableUtils';
import { SqlQueryEditorProps } from './components/QueryEditor';
import { SqlQueryEditorLazy } from './components/QueryEditorLazy';
import { type SQLQuery, type SQLQueryMeta, SQLDialect } from './types';

type SQLVariableQueryEditorProps = SqlQueryEditorProps;

export const SQLVariablesQueryEditor = <T extends SQLDialect>(props: SQLVariableQueryEditorProps) => {
  const query = useMemo(() => migrateVariableQuery(props.query), [props.query]);
  const dialect = props.queryHeaderProps?.dialect ?? props.datasource.dialect ?? 'other';
  return (
    <>
      <SqlQueryEditorLazy
        {...props}
        query={query}
        queryHeaderProps={{ hideFormatSelector: true, hideRunButton: true, dialect }}
      />
      <FieldMapping {...props} query={query} />
    </>
  );
};

const FieldMapping = (props: SQLVariableQueryEditorProps) => {
  const { query, datasource, onChange } = props;
  const [choices, setChoices] = useState<ComboboxOption[]>([]);

  // Track the actual SQL content to avoid re-querying when only meta changes
  const queryRef = useRef(query);
  queryRef.current = query;

  // Only re-run the query when the SQL content changes, not when meta (valueField/textField) changes
  const queryKey = useMemo(() => JSON.stringify({ rawSql: query.rawSql, sql: query.sql }), [query.rawSql, query.sql]);

  useEffect(() => {
    let isActive = true;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const subscription = datasource.query({ targets: [queryRef.current] } as DataQueryRequest<SQLQuery>).subscribe({
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
  }, [datasource, queryKey]);
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
