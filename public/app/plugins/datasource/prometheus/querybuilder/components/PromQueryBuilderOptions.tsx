import React, { SyntheticEvent } from 'react';
import { EditorRow, EditorField } from '@grafana/experimental';
import { CoreApp, SelectableValue } from '@grafana/data';
import { Input, RadioButtonGroup, Select, Switch } from '@grafana/ui';
import { QueryOptionGroup } from '../shared/QueryOptionGroup';
import { PromQuery } from '../../types';
import { FORMAT_OPTIONS, INTERVAL_FACTOR_OPTIONS } from '../../components/PromQueryEditor';
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

  const queryTypeOptions = getQueryTypeOptions(app === CoreApp.Explore);
  const onQueryTypeChange = getQueryTypeChangeHandler(query, onChange);

  const onExemplarChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const isEnabled = event.currentTarget.checked;
    onChange({ ...query, exemplar: isEnabled });
    onRunQuery();
  };

  const onIntervalFactorChange = (value: SelectableValue<number>) => {
    onChange({ ...query, intervalFactor: value.value });
    onRunQuery();
  };

  return (
    <EditorRow>
      <QueryOptionGroup title="Options" collapsedInfo={getCollapsedInfo(query, formatOption)}>
        <EditorField
          label="Legend"
          tooltip="Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname."
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
          <RadioButtonGroup options={queryTypeOptions} value={getQueryTypeValue(query)} onChange={onQueryTypeChange} />
        </EditorField>
        {shouldShowExemplarSwitch(query, app) && (
          <EditorField label="Exemplars">
            <Switch value={query.exemplar} onChange={onExemplarChange} />
          </EditorField>
        )}
        {query.intervalFactor && query.intervalFactor > 1 && (
          <EditorField label="Resolution">
            <Select
              aria-label="Select resolution"
              menuShouldPortal
              isSearchable={false}
              options={INTERVAL_FACTOR_OPTIONS}
              onChange={onIntervalFactorChange}
              value={INTERVAL_FACTOR_OPTIONS.find((option) => option.value === query.intervalFactor)}
            />
          </EditorField>
        )}
      </QueryOptionGroup>
    </EditorRow>
  );
});

function shouldShowExemplarSwitch(query: PromQuery, app?: CoreApp) {
  if (app === CoreApp.UnifiedAlerting || !query.range) {
    return false;
  }

  return true;
}

function getQueryTypeValue(query: PromQuery) {
  return query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range';
}

function getCollapsedInfo(query: PromQuery, formatOption: SelectableValue<string>): string[] {
  const items: string[] = [];

  if (query.legendFormat) {
    items.push(`Legend: ${query.legendFormat}`);
  }

  items.push(`Format: ${formatOption.label}`);

  if (query.interval) {
    items.push(`Step ${query.interval}`);
  }

  items.push(`Type: ${getQueryTypeValue(query)}`);

  if (query.exemplar) {
    items.push(`Exemplars: true`);
  }

  return items;
}

PromQueryBuilderOptions.displayName = 'PromQueryBuilderOptions';
