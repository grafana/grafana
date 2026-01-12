import { useEffect, useState } from 'react';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  QueryEditorProps,
  Field,
  DataFrame,
  MetricFindValue,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { EditorMode, EditorRows, EditorRow, EditorField } from '@grafana/plugin-ui';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { SqlQueryEditorLazy } from './components/QueryEditorLazy';
import { SqlDatasource } from './datasource/SqlDatasource';
import { applyQueryDefaults } from './defaults';
import { QueryFormat, type SQLQuery, type SQLOptions, type SQLQueryMeta } from './types';

type SQLVariableQuery = { query: string } & SQLQuery;

const refId = 'SQLVariableQueryEditor-VariableQuery';

export class SQLVariableSupport extends CustomVariableSupport<SqlDatasource, SQLQuery> {
  constructor(readonly datasource: SqlDatasource) {
    super();
  }
  editor = SQLVariablesQueryEditor;
  query(request: DataQueryRequest<SQLQuery>): Observable<DataQueryResponse> {
    if (request.targets.length < 1) {
      throw new Error('no variable query found');
    }
    const updatedQuery = migrateVariableQuery(request.targets[0]);
    return this.datasource.query({ ...request, targets: [updatedQuery] }).pipe(
      map((d: DataQueryResponse) => {
        const frames = d.data || [];
        const metricFindValues = convertDataFramesToMetricFindValues(frames, updatedQuery.meta);
        return { data: metricFindValues };
      })
    );
  }
  getDefaultQuery(): Partial<SQLQuery> {
    return applyQueryDefaults({ refId, editorMode: EditorMode.Builder, format: QueryFormat.Table });
  }
}

type SQLVariableQueryEditorProps = QueryEditorProps<SqlDatasource, SQLQuery, SQLOptions>;

const SQLVariablesQueryEditor = (props: SQLVariableQueryEditorProps) => {
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

const migrateVariableQuery = (rawQuery: string | SQLQuery): SQLVariableQuery => {
  if (typeof rawQuery !== 'string') {
    return {
      ...rawQuery,
      refId: rawQuery.refId || refId,
      query: rawQuery.rawSql || '',
    };
  }
  return {
    ...applyQueryDefaults({
      refId,
      rawSql: rawQuery,
      editorMode: rawQuery ? EditorMode.Code : EditorMode.Builder,
    }),
    query: rawQuery,
  };
};

const convertDataFramesToMetricFindValues = (frames: DataFrame[], meta?: SQLQueryMeta): MetricFindValue[] => {
  if (!frames.length) {
    throw new Error('no results found');
  }

  const frame = frames[0];

  const fields = frame.fields;

  if (fields.length < 1) {
    throw new Error('no fields found in the response');
  }

  let textField = fields.find((f) => f.name === '__text');
  let valueField = fields.find((f) => f.name === '__value');
  if (meta?.textField) {
    textField = fields.find((f) => f.name === meta.textField);
  }
  if (meta?.valueField) {
    valueField = fields.find((f) => f.name === meta.valueField);
  }
  const resolvedTextField = textField || valueField || fields[0];
  const resolvedValueField = valueField || textField || fields[0];

  const results: MetricFindValue[] = [];
  const rowCount = frame.length;
  for (let i = 0; i < rowCount; i++) {
    const text = String(resolvedTextField.values[i] ?? '');
    const value = String(resolvedValueField.values[i] ?? '');
    const properties: Record<string, string> = {};
    for (const field of fields) {
      properties[field.name] = String(field.values[i] ?? '');
    }
    results.push({ text, value, properties });
  }
  return results;
};
