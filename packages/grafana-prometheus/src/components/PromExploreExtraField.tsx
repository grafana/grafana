// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PromExploreExtraField.tsx
import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { memo, useCallback } from 'react';
import * as React from 'react';
import { usePrevious } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { InlineFormLabel, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

import { PromExemplarField } from './PromExemplarField';

export interface PromExploreExtraFieldProps {
  query: PromQuery;
  onChange: (value: PromQuery) => void;
  onRunQuery: () => void;
  datasource: PrometheusDatasource;
}

export const PromExploreExtraField = memo(({ query, datasource, onChange, onRunQuery }: PromExploreExtraFieldProps) => {
  const rangeOptions = getQueryTypeOptions(true);
  const prevQuery = usePrevious(query);
  const styles = useStyles2(getStyles);

  const onExemplarChange = useCallback(
    (exemplar: boolean) => {
      if (!isEqual(query, prevQuery) || exemplar !== query.exemplar) {
        onChange({ ...query, exemplar });
      }
    },
    [prevQuery, query, onChange]
  );

  function onChangeQueryStep(interval: string) {
    onChange({ ...query, interval });
  }

  function onStepChange(e: React.SyntheticEvent<HTMLInputElement>) {
    if (e.currentTarget.value !== query.interval) {
      onChangeQueryStep(e.currentTarget.value);
    }
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && e.shiftKey) {
      onRunQuery();
    }
  }

  const onQueryTypeChange = getQueryTypeChangeHandler(query, onChange);

  return (
    <div
      aria-label="Prometheus extra field"
      className="gf-form-inline"
      data-testid={promExploreExtraFieldTestIds.extraFieldEditor}
    >
      {/*Query type field*/}
      <div
        data-testid={promExploreExtraFieldTestIds.queryTypeField}
        className={cx(
          'gf-form',
          styles.queryTypeField,
          css({
            flexWrap: 'nowrap',
          })
        )}
        aria-label="Query type field"
      >
        <InlineFormLabel width="auto">Query type</InlineFormLabel>

        <RadioButtonGroup
          options={rangeOptions}
          value={query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range'}
          onChange={onQueryTypeChange}
        />
      </div>
      {/*Step field*/}
      <div
        data-testid={promExploreExtraFieldTestIds.stepField}
        className={cx(
          'gf-form',
          css({
            flexWrap: 'nowrap',
          })
        )}
        aria-label="Step field"
      >
        <InlineFormLabel
          width={6}
          tooltip={
            'Time units and built-in variables can be used here, for example: $__interval, $__rate_interval, 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: s)'
          }
        >
          Min step
        </InlineFormLabel>
        <input
          type={'text'}
          className="gf-form-input width-4"
          placeholder={'auto'}
          onChange={onStepChange}
          onKeyDown={onReturnKeyDown}
          value={query.interval ?? ''}
        />
      </div>

      <PromExemplarField onChange={onExemplarChange} datasource={datasource} query={query} />
    </div>
  );
});

PromExploreExtraField.displayName = 'PromExploreExtraField';

export function getQueryTypeOptions(includeBoth: boolean) {
  const rangeOptions = [
    { value: 'range', label: 'Range', description: 'Run query over a range of time' },
    {
      value: 'instant',
      label: 'Instant',
      description: 'Run query against a single point in time. For this query, the "To" time is used',
    },
  ];

  if (includeBoth) {
    rangeOptions.push({ value: 'both', label: 'Both', description: 'Run an Instant query and a Range query' });
  }

  return rangeOptions;
}

export function getQueryTypeChangeHandler(query: PromQuery, onChange: (update: PromQuery) => void) {
  return (queryType: string) => {
    if (queryType === 'instant') {
      onChange({ ...query, instant: true, range: false, exemplar: false });
    } else if (queryType === 'range') {
      onChange({ ...query, instant: false, range: true });
    } else {
      onChange({ ...query, instant: true, range: true });
    }
  };
}

export const promExploreExtraFieldTestIds = {
  extraFieldEditor: 'prom-editor-extra-field',
  stepField: 'prom-editor-extra-field-step',
  queryTypeField: 'prom-editor-extra-field-query-type',
};

const getStyles = (theme: GrafanaTheme2) => ({
  queryTypeField: css({
    marginRight: theme.spacing(0.5),
  }),
});
