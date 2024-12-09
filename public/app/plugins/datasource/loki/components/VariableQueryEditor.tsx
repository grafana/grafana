import { FormEvent, useState, useEffect } from 'react';
import { usePrevious } from 'react-use';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import { LokiDatasource } from '../datasource';
import { migrateVariableQuery } from '../migrations/variableQueryMigrations';
import { LokiOptions, LokiQuery, LokiVariableQuery, LokiVariableQueryType as QueryType } from '../types';

const variableOptions = [
  { label: 'Label names', value: QueryType.LabelNames },
  { label: 'Label values', value: QueryType.LabelValues },
];

export type Props = QueryEditorProps<LokiDatasource, LokiQuery, LokiOptions, LokiVariableQuery>;

const refId = 'LokiVariableQueryEditor-VariableQuery';

export const LokiVariableQueryEditor = ({ onChange, query, datasource, range }: Props) => {
  const [type, setType] = useState<number | undefined>(undefined);
  const [label, setLabel] = useState('');
  const [labelOptions, setLabelOptions] = useState<Array<SelectableValue<string>>>([]);
  const [stream, setStream] = useState('');
  const previousType = usePrevious(type);

  useEffect(() => {
    if (!query) {
      return;
    }

    const variableQuery = typeof query === 'string' ? migrateVariableQuery(query) : query;
    setType(variableQuery.type);
    setLabel(variableQuery.label || '');
    setStream(variableQuery.stream || '');
  }, [query]);

  useEffect(() => {
    // Fetch label names when the query type is LabelValues, and the previous type was not the same
    if (type !== QueryType.LabelValues || previousType === type) {
      return;
    }

    datasource.languageProvider.fetchLabels({ timeRange: range }).then((labelNames) => {
      setLabelOptions(labelNames.map((labelName) => ({ label: labelName, value: labelName })));
    });
  }, [datasource, type, range, previousType]);

  const onQueryTypeChange = (newType: SelectableValue<QueryType>) => {
    setType(newType.value);
    if (newType.value !== undefined) {
      onChange({
        type: newType.value,
        label,
        stream,
        refId,
      });
    }
  };

  const onLabelChange = (newLabel: SelectableValue<string>) => {
    setLabel(newLabel.value || '');
  };

  const onStreamChange = (e: FormEvent<HTMLInputElement>) => {
    setStream(e.currentTarget.value);
  };

  const handleBlur = () => {
    if (type !== undefined) {
      onChange({ type, label, stream, refId: 'LokiVariableQueryEditor-VariableQuery' });
    }
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query type" labelWidth={20}>
          <Select
            aria-label="Query type"
            onChange={onQueryTypeChange}
            onBlur={handleBlur}
            value={type}
            options={variableOptions}
            width={16}
          />
        </InlineField>
        {type === QueryType.LabelValues && (
          <>
            <InlineField label="Label" labelWidth={20}>
              <Select
                aria-label="Label"
                onChange={onLabelChange}
                onBlur={handleBlur}
                value={{ label: label, value: label }}
                options={labelOptions}
                width={16}
                allowCustomValue
              />
            </InlineField>
          </>
        )}
      </InlineFieldRow>
      {type === QueryType.LabelValues && (
        <InlineFieldRow>
          <InlineField
            label="Stream selector"
            labelWidth={20}
            grow={true}
            tooltip={
              <div>
                {
                  'Optional. If defined, a list of values for the specified log stream selector is returned. For example: {label="value"} or {label="$variable"}'
                }
              </div>
            }
          >
            <Input
              type="text"
              aria-label="Stream selector"
              placeholder="Optional stream selector"
              value={stream}
              onChange={onStreamChange}
              onBlur={handleBlur}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
