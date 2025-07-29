// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilderOptions.tsx
import { map } from 'lodash';
import { SyntheticEvent } from 'react';
import * as React from 'react';

import { CoreApp, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { EditorField, EditorRow, EditorSwitch } from '@grafana/plugin-ui';
import { AutoSizeInput, RadioButtonGroup, Select } from '@grafana/ui';

import { getQueryTypeChangeHandler, getQueryTypeOptions } from '../../components/PromExploreExtraField';
import { PromQueryFormat } from '../../dataquery';
import { PromQuery } from '../../types';
import { QueryOptionGroup } from '../shared/QueryOptionGroup';

import { getLegendModeLabel, PromQueryLegendEditor } from './PromQueryLegendEditor';

interface PromQueryBuilderOptionsProps {
  query: PromQuery;
  app?: CoreApp;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
}

const INTERVAL_FACTOR_OPTIONS: Array<SelectableValue<number>> = map([1, 2, 3, 4, 5, 10], (value: number) => ({
  value,
  label: '1/' + value,
}));

export const PromQueryBuilderOptions = React.memo<PromQueryBuilderOptionsProps>(
  ({ query, app, onChange, onRunQuery }) => {
    const FORMAT_OPTIONS: Array<SelectableValue<PromQueryFormat>> = [
      {
        label: t(
          'grafana-prometheus.querybuilder.prom-query-builder-options.format-options.label-time-series',
          'Time series'
        ),
        value: 'time_series',
      },
      {
        label: t('grafana-prometheus.querybuilder.prom-query-builder-options.format-options.label-table', 'Table'),
        value: 'table',
      },
      {
        label: t('grafana-prometheus.querybuilder.prom-query-builder-options.format-options.label-heatmap', 'Heatmap'),
        value: 'heatmap',
      },
    ];

    const onChangeFormat = (value: SelectableValue<PromQueryFormat>) => {
      onChange({ ...query, format: value.value });
      onRunQuery();
    };

    const onChangeStep = (evt: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...query, interval: evt.currentTarget.value.trim() });
      onRunQuery();
    };

    const queryTypeOptions = getQueryTypeOptions(
      app === CoreApp.Explore || app === CoreApp.Correlations || app === CoreApp.PanelEditor
    );

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

    const formatOption = FORMAT_OPTIONS.find((option) => option.value === query.format) || FORMAT_OPTIONS[0];
    const queryTypeValue = getQueryTypeValue(query);
    const queryTypeLabel = queryTypeOptions.find((x) => x.value === queryTypeValue)!.label;

    return (
      <EditorRow>
        <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.options}>
          <QueryOptionGroup
            title={t('grafana-prometheus.querybuilder.prom-query-builder-options.title-options', 'Options')}
            collapsedInfo={getCollapsedInfo(query, formatOption.label!, queryTypeLabel, app)}
          >
            <PromQueryLegendEditor
              legendFormat={query.legendFormat}
              onChange={(legendFormat) => onChange({ ...query, legendFormat })}
              onRunQuery={onRunQuery}
            />
            <EditorField
              label={t('grafana-prometheus.querybuilder.prom-query-builder-options.label-min-step', 'Min step')}
              tooltip={
                <>
                  <Trans
                    i18nKey="grafana-prometheus.querybuilder.prom-query-builder-options.tooltip-min-step"
                    values={{
                      interval: '$__interval',
                      rateInterval: '$__rate_interval',
                    }}
                  >
                    An additional lower limit for the step parameter of the Prometheus query and for the{' '}
                    <code>{'{{interval}}'}</code> and <code>{'{{rateInterval}}'}</code> variables.
                  </Trans>
                </>
              }
            >
              <AutoSizeInput
                type="text"
                aria-label={t(
                  'grafana-prometheus.querybuilder.prom-query-builder-options.aria-label-lower-limit-parameter',
                  'Set lower limit for the step parameter'
                )}
                placeholder={t('grafana-prometheus.querybuilder.prom-query-builder-options.placeholder-auto', 'auto')}
                minWidth={10}
                onCommitChange={onChangeStep}
                defaultValue={query.interval}
                data-testid={selectors.components.DataSource.Prometheus.queryEditor.step}
              />
            </EditorField>
            <EditorField label={t('grafana-prometheus.querybuilder.prom-query-builder-options.label-format', 'Format')}>
              <Select
                data-testid={selectors.components.DataSource.Prometheus.queryEditor.format}
                value={formatOption}
                allowCustomValue
                onChange={onChangeFormat}
                options={FORMAT_OPTIONS}
              />
            </EditorField>
            <EditorField
              label={t('grafana-prometheus.querybuilder.prom-query-builder-options.label-type', 'Type')}
              data-testid={selectors.components.DataSource.Prometheus.queryEditor.type}
            >
              <RadioButtonGroup options={queryTypeOptions} value={queryTypeValue} onChange={onQueryTypeChange} />
            </EditorField>
            {shouldShowExemplarSwitch(query, app) && (
              <EditorField
                label={t('grafana-prometheus.querybuilder.prom-query-builder-options.label-exemplars', 'Exemplars')}
              >
                <EditorSwitch
                  value={query.exemplar || false}
                  onChange={onExemplarChange}
                  data-testid={selectors.components.DataSource.Prometheus.queryEditor.exemplars}
                />
              </EditorField>
            )}
            {query.intervalFactor && query.intervalFactor > 1 && (
              <EditorField
                label={t('grafana-prometheus.querybuilder.prom-query-builder-options.label-resolution', 'Resolution')}
              >
                <Select
                  aria-label={t(
                    'grafana-prometheus.querybuilder.prom-query-builder-options.aria-label-select-resolution',
                    'Select resolution'
                  )}
                  isSearchable={false}
                  options={INTERVAL_FACTOR_OPTIONS}
                  onChange={onIntervalFactorChange}
                  value={INTERVAL_FACTOR_OPTIONS.find((option) => option.value === query.intervalFactor)}
                />
              </EditorField>
            )}
          </QueryOptionGroup>
        </div>
      </EditorRow>
    );
  }
);

function shouldShowExemplarSwitch(query: PromQuery, app?: CoreApp) {
  if (app === CoreApp.UnifiedAlerting || !query.range) {
    return false;
  }

  return true;
}

function getQueryTypeValue(query: PromQuery) {
  return query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range';
}

function getCollapsedInfo(query: PromQuery, formatOption: string, queryType: string, app?: CoreApp): string[] {
  const items: string[] = [];

  items.push(
    t('grafana-prometheus.querybuilder.get-collapsed-info.legend', 'Legend: {{value}}', {
      value: getLegendModeLabel(query.legendFormat),
    })
  );
  items.push(
    t('grafana-prometheus.querybuilder.get-collapsed-info.format', 'Format: {{value}}', { value: formatOption })
  );
  items.push(
    t('grafana-prometheus.querybuilder.get-collapsed-info.step', 'Step: {{value}}', { value: query.interval ?? 'auto' })
  );
  items.push(t('grafana-prometheus.querybuilder.get-collapsed-info.type', 'Type: {{value}}', { value: queryType }));

  if (shouldShowExemplarSwitch(query, app)) {
    items.push(
      t('grafana-prometheus.querybuilder.get-collapsed-info.exemplars', 'Exemplars: {{value}}', {
        value: query.exemplar ? 'true' : 'false',
      })
    );
  }
  return items;
}

PromQueryBuilderOptions.displayName = 'PromQueryBuilderOptions';
