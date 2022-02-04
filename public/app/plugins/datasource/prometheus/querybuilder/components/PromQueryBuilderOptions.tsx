import React from 'react';
import { EditorRow, EditorFieldGroup, EditorField } from '@grafana/experimental';
import { SelectableValue } from '@grafana/data';
import { Input, Select } from '@grafana/ui';
import { QueryOptionGroup } from '../shared/QueryOptionGroup';
import { PromQuery } from '../../types';
import { FORMAT_OPTIONS } from '../../components/PromQueryEditor';

export interface Props {
  query: PromQuery;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
}

export const PromQueryBuilderOptions = React.memo<Props>(({ query, onChange, onRunQuery }) => {
  const formatOption = FORMAT_OPTIONS.find((option) => option.value === query.format) || FORMAT_OPTIONS[0];

  const onChangeFormat = (value: SelectableValue<string>) => {
    onChange({ ...query, format: value.value });
    onRunQuery();
  };

  const onLegendFormatChanged = (evt: React.FocusEvent<HTMLInputElement>) => {
    onChange({ ...query, legendFormat: evt.currentTarget.value });
    onRunQuery();
  };

  const onChangeStep = (evt: React.FocusEvent<HTMLInputElement>) => {
    onChange({ ...query, interval: evt.currentTarget.value });
    onRunQuery();
  };

  return (
    <EditorRow>
      <QueryOptionGroup title="Options" collapsedInfo={getCollapsedInfo(query, formatOption)}>
        <EditorFieldGroup>
          <EditorField
            label="Legend"
            tooltip="Controls the name of the time series, using name or pattern. For example
        {{hostname}} will be replaced with label value for the label hostname."
          >
            <Input placeholder="auto" defaultValue={query.legendFormat} onBlur={onLegendFormatChanged} />
          </EditorField>
        </EditorFieldGroup>
        <EditorFieldGroup>
          <EditorField
            label="Min step"
            tooltip={
              <>
                An additional lower limit for the step parameter of the Prometheus query and for the{' '}
                <code>$__interval</code> and <code>$__rate_interval</code> variables.
              </>
            }
          >
            <Input
              type="text"
              aria-label="Set lower limit for the step parameter"
              placeholder={'auto'}
              width={10}
              onBlur={onChangeStep}
              defaultValue={query.interval}
            />
          </EditorField>
        </EditorFieldGroup>
        <EditorFieldGroup>
          <EditorField label="Format">
            <Select value={formatOption} allowCustomValue onChange={onChangeFormat} options={FORMAT_OPTIONS} />
          </EditorField>
        </EditorFieldGroup>
      </QueryOptionGroup>
    </EditorRow>
  );
});

function getCollapsedInfo(query: PromQuery, formatOption: SelectableValue<string>): string[] {
  const items: string[] = [];

  if (query.legendFormat) {
    items.push(`Legend: ${query.legendFormat}`);
  }

  items.push(`Format: ${formatOption.label}`);
  items.push(`Step ${query.interval}`);

  return items;
}

PromQueryBuilderOptions.displayName = 'PromQueryBuilderOptions';
