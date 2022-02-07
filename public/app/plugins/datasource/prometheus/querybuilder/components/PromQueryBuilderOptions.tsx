import React, { SyntheticEvent } from 'react';
import { EditorRow, EditorField } from '@grafana/experimental';
import { CoreApp, SelectableValue } from '@grafana/data';
import { Input, RadioButtonGroup, Select, Switch } from '@grafana/ui';
import { QueryOptionGroup } from '../shared/QueryOptionGroup';
import { PromQuery } from '../../types';
import { FORMAT_OPTIONS } from '../../components/PromQueryEditor';
import { getQueryTypeChangeHandler, getQueryTypeOptions } from '../../components/PromExploreExtraField';

export interface Props {
  query: PromQuery;
  app?: CoreApp;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
}

export const PromQueryBuilderOptions = React.memo<Props>(({ query, app, onChange, onRunQuery }) => {
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

  const queryTypeOptions = getQueryTypeOptions(false);
  const onQueryTypeChange = getQueryTypeChangeHandler(query, onChange);

  const onExemplarChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const isEnabled = event.currentTarget.checked;
    onChange({ ...query, exemplar: isEnabled });
    onRunQuery();
  };

  const showExemplarSwitch = app !== CoreApp.UnifiedAlerting && !query.instant;

  return (
    <EditorRow>
      <QueryOptionGroup title="Options" collapsedInfo={getCollapsedInfo(query, formatOption)}>
        <EditorField
          label="Legend"
          tooltip="Controls the name of the time series, using name or pattern. For example
        {{hostname}} will be replaced with label value for the label hostname."
        >
          <Input placeholder="auto" defaultValue={query.legendFormat} onBlur={onLegendFormatChanged} />
        </EditorField>
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

        <EditorField label="Format">
          <Select value={formatOption} allowCustomValue onChange={onChangeFormat} options={FORMAT_OPTIONS} />
        </EditorField>
        <EditorField label="Type">
          <RadioButtonGroup
            options={queryTypeOptions}
            value={query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range'}
            onChange={onQueryTypeChange}
          />
        </EditorField>
        {showExemplarSwitch && (
          <EditorField label="Exemplars">
            <Switch value={query.exemplar} onChange={onExemplarChange} />
          </EditorField>
        )}
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

  if (query.interval) {
    items.push(`Step ${query.interval}`);
  }

  if (query.instant) {
    items.push(`Instant: true`);
  }

  if (query.exemplar) {
    items.push(`Exemplars: true`);
  }

  return items;
}

PromQueryBuilderOptions.displayName = 'PromQueryBuilderOptions';
