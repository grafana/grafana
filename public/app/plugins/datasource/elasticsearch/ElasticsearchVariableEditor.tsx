import { useEffect, useMemo, useRef, useState } from 'react';

import { DataQueryRequest, dateTime, Field } from '@grafana/data';
import { EditorRows, EditorRow, EditorField } from '@grafana/plugin-ui';
import { Combobox, ComboboxOption, Text } from '@grafana/ui';

import { ElasticsearchVariableQuery, migrateVariableQuery, refId } from './ElasticsearchVariableUtils';
import { ElasticQueryEditorProps, QueryEditor } from './components/QueryEditor';
import { ElasticsearchDataQuery } from './dataquery.gen';

type ElasticsearchVariableQueryEditorProps = ElasticQueryEditorProps;

export const ElasticsearchVariableEditor = (props: ElasticsearchVariableQueryEditorProps) => {
  const query = useMemo(() => migrateVariableQuery(props.query), [props.query]);

  return (
    <>
      <QueryEditor {...props} query={query} />
      <FieldMapping datasource={props.datasource} query={query} onChange={props.onChange} />
    </>
  );
};

interface FieldMappingProps {
  datasource: ElasticsearchVariableQueryEditorProps['datasource'];
  query: ElasticsearchVariableQuery;
  onChange: ElasticsearchVariableQueryEditorProps['onChange'];
}

const FieldMapping = (props: FieldMappingProps) => {
  const { query, datasource, onChange } = props;
  const [choices, setChoices] = useState<ComboboxOption[]>([]);

  // Track the actual query content to avoid re-querying when only meta changes
  const queryRef = useRef(query);
  queryRef.current = query;

  // Only re-run the query when the query content changes, not when meta (valueField/textField) changes
  const queryKey = useMemo(
    () =>
      JSON.stringify({
        query: query.query,
        metrics: query.metrics,
        bucketAggs: query.bucketAggs,
        queryType: query.queryType,
      }),
    [query.query, query.metrics, query.bucketAggs, query.queryType]
  );

  // Reset field mappings when the query type changes — the available fields may be completely different
  const prevQueryTypeRef = useRef(query.queryType);
  useEffect(() => {
    const prevQueryType = prevQueryTypeRef.current;
    prevQueryTypeRef.current = query.queryType;
    if (prevQueryType !== undefined && prevQueryType !== query.queryType) {
      onChange({ ...queryRef.current, meta: {} });
    }
  }, [query.queryType, onChange]);

  useEffect(() => {
    let isActive = true;
    const request: DataQueryRequest<ElasticsearchDataQuery> = {
      targets: [queryRef.current],
      requestId: 'variable-field-fetch',
      interval: '1s',
      intervalMs: 1000,
      range: {
        from: dateTime(Date.now() - 3600000),
        to: dateTime(Date.now()),
        raw: { from: 'now-1h', to: 'now' },
      },
      scopedVars: {},
      timezone: 'browser',
      app: 'dashboard',
      startTime: Date.now(),
    };
    const subscription = datasource.query(request).subscribe({
      next: (response) => {
        if (!isActive) {
          return;
        }
        const fieldNames = (response.data[0] || { fields: [] }).fields
          .filter((f: Field) => f.name !== refId)
          .map((f: Field) => f.name);
        setChoices(fieldNames.map((f: string) => ({ value: f, label: f })));
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

  const isRawDocumentQuery =
    !query.metrics ||
    query.metrics.length === 0 ||
    query.metrics.every((m) => m.type === 'raw_document' || m.type === 'raw_data');

  const onMetaPropChange = (key: 'textField' | 'valueField', value: string | undefined) => {
    const meta = query.meta || {};
    onChange({ ...query, meta: { ...meta, [key]: value } });
  };

  return (
    <EditorRows>
      {isRawDocumentQuery && (
        <EditorRow>
          <Text color="secondary" variant="bodySmall">
            Raw document queries do not return named column fields — this is expected. For field mapping, use an
            aggregation query type, or type a field name directly below.
          </Text>
        </EditorRow>
      )}
      <EditorRow>
        <EditorField label="Value Field">
          <Combobox
            isClearable
            createCustomValue
            value={query.meta?.valueField}
            onChange={(e) => onMetaPropChange('valueField', e?.value)}
            width={40}
            options={choices}
          />
        </EditorField>
        <EditorField label="Text Field">
          <Combobox
            isClearable
            createCustomValue
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
