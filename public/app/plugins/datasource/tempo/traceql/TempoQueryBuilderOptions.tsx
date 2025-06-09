import { css } from '@emotion/css';
import * as React from 'react';
import { useToggle } from 'react-use';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorRow } from '@grafana/plugin-ui';
import { AutoSizeInput, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { QueryOptionGroup } from '../_importedDependencies/datasources/prometheus/QueryOptionGroup';
import { SearchTableType, MetricsQueryType } from '../dataquery.gen';
import { DEFAULT_LIMIT, DEFAULT_SPSS } from '../datasource';
import { TempoQuery } from '../types';

interface Props {
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
  searchStreaming: boolean;
  metricsStreaming: boolean;
  app?: CoreApp;
}

/**
 * Parse a string value to integer. If the conversion fails, for example because we are prosessing an empty value for
 * a field, return a fallback (default) value.
 *
 * @param val the value to be parsed to an integer
 * @param fallback the fallback value
 * @returns the converted value or the fallback value if the conversion fails
 */
const parseIntWithFallback = (val: string, fallback: number) => {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

export const TempoQueryBuilderOptions = React.memo<Props>(
  ({ onChange, query, searchStreaming, metricsStreaming, app }) => {
    const styles = useStyles2(getStyles);
    const [isOpen, toggleOpen] = useToggle(false);
    const isAlerting = app === CoreApp.UnifiedAlerting;

    if (!query.hasOwnProperty('limit')) {
      query.limit = DEFAULT_LIMIT;
    }

    if (!query.hasOwnProperty('tableType')) {
      query.tableType = SearchTableType.Traces;
    }

    if (!query.hasOwnProperty('metricsQueryType')) {
      query.metricsQueryType = MetricsQueryType.Range;
    }

    if (isAlerting && query.metricsQueryType === MetricsQueryType.Range) {
      onChange({ ...query, metricsQueryType: MetricsQueryType.Instant });
    }

    const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...query, limit: parseIntWithFallback(e.currentTarget.value, DEFAULT_LIMIT) });
    };
    const onSpssChange = (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...query, spss: parseIntWithFallback(e.currentTarget.value, DEFAULT_SPSS) });
    };
    const onTableTypeChange = (val: SearchTableType) => {
      onChange({ ...query, tableType: val });
    };
    const onMetricsQueryTypeChange = (val: MetricsQueryType) => {
      onChange({ ...query, metricsQueryType: val });
    };
    const onStepChange = (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...query, step: e.currentTarget.value });
    };

    // There's a bug in Tempo which causes the exemplars param to be ignored. It's commented out for now.

    // const onExemplarsChange = (e: React.FormEvent<HTMLInputElement>) => {
    //   const exemplars = parseInt(e.currentTarget.value, 10);
    //   if (!isNaN(exemplars) && exemplars >= 0) {
    //     onChange({ ...query, exemplars });
    //   } else {
    //     onChange({ ...query, exemplars: undefined });
    //   }
    // };

    const collapsedSearchOptions = [
      `Limit: ${query.limit || DEFAULT_LIMIT}`,
      `Spans Limit: ${query.spss || DEFAULT_SPSS}`,
      `Table Format: ${query.tableType === SearchTableType.Traces ? 'Traces' : 'Spans'}`,
      '|',
      `Streaming: ${searchStreaming ? 'Enabled' : 'Disabled'}`,
    ];

    const collapsedMetricsOptions = [
      `Step: ${query.step || 'auto'}`,
      `Type: ${query.metricsQueryType === MetricsQueryType.Range ? 'Range' : 'Instant'}`,
      '|',
      `Streaming: ${metricsStreaming ? 'Enabled' : 'Disabled'}`,
      // `Exemplars: ${query.exemplars !== undefined ? query.exemplars : 'auto'}`,
    ];

    return (
      <EditorRow>
        <div className={styles.options}>
          {!isAlerting && (
            <QueryOptionGroup
              title="Search Options"
              collapsedInfo={collapsedSearchOptions}
              isOpen={isOpen}
              onToggle={toggleOpen}
            >
              <EditorField label="Limit" tooltip="Maximum number of traces to return.">
                <AutoSizeInput
                  className="width-4"
                  placeholder="auto"
                  type="number"
                  min={1}
                  defaultValue={query.limit || DEFAULT_LIMIT}
                  onCommitChange={onLimitChange}
                  value={query.limit}
                />
              </EditorField>
              <EditorField label="Span Limit" tooltip="Maximum number of spans to return for each span set.">
                <AutoSizeInput
                  className="width-4"
                  placeholder="auto"
                  type="number"
                  min={1}
                  defaultValue={query.spss || DEFAULT_SPSS}
                  onCommitChange={onSpssChange}
                  value={query.spss}
                />
              </EditorField>
              <EditorField label="Table Format" tooltip="How the query data should be displayed in the results table">
                <RadioButtonGroup
                  options={[
                    { label: 'Traces', value: SearchTableType.Traces },
                    { label: 'Spans', value: SearchTableType.Spans },
                  ]}
                  value={query.tableType}
                  onChange={onTableTypeChange}
                />
              </EditorField>
              <EditorField label="Streaming" tooltip={<StreamingTooltip />} tooltipInteractive>
                <div>{searchStreaming ? 'Enabled' : 'Disabled'}</div>
              </EditorField>
            </QueryOptionGroup>
          )}

          <QueryOptionGroup
            title="Metrics Options"
            collapsedInfo={collapsedMetricsOptions}
            isOpen={isOpen}
            onToggle={toggleOpen}
          >
            {!isAlerting && (
              <EditorField
                label="Step"
                tooltip="Defines the step for metric queries. Use duration notation, for example 30s or 1m"
              >
                <AutoSizeInput
                  className="width-4"
                  placeholder="auto"
                  type="string"
                  defaultValue={query.step}
                  onCommitChange={onStepChange}
                  value={query.step}
                />
              </EditorField>
            )}
            <EditorField label="Type" tooltip="Type of metrics query to run">
              <RadioButtonGroup
                options={[
                  { label: 'Range', value: MetricsQueryType.Range },
                  { label: 'Instant', value: MetricsQueryType.Instant },
                ]}
                value={query.metricsQueryType}
                onChange={onMetricsQueryTypeChange}
                disabled={isAlerting}
              />
            </EditorField>

            <EditorField label="Streaming" tooltip={<StreamingTooltip />} tooltipInteractive>
              <div>{metricsStreaming ? 'Enabled' : 'Disabled'}</div>
            </EditorField>
            {/*<EditorField*/}
            {/*  label="Exemplars"*/}
            {/*  tooltip="Defines the amount of exemplars to request for metric queries. A value of 0 means no exemplars."*/}
            {/*>*/}
            {/*  <AutoSizeInput*/}
            {/*    className="width-4"*/}
            {/*    placeholder="auto"*/}
            {/*    type="string"*/}
            {/*    defaultValue={query.exemplars}*/}
            {/*    onCommitChange={onExemplarsChange}*/}
            {/*    value={query.exemplars}*/}
            {/*  />*/}
            {/*</EditorField>*/}
          </QueryOptionGroup>
        </div>
      </EditorRow>
    );
  }
);

const StreamingTooltip = () => {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <span>
        Indicates if streaming is currently enabled. Streaming allows you to view partial query results before the
        entire query completes.
      </span>
      <a
        href={'https://grafana.com/docs/tempo/latest/traceql/#stream-query-results'}
        aria-label={'Learn more about streaming query results'}
        target={'_blank'}
        rel="noreferrer"
        style={{ textDecoration: 'underline' }}
      >
        Learn more
      </a>
    </div>
  );
};

TempoQueryBuilderOptions.displayName = 'TempoQueryBuilderOptions';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    options: css({
      display: 'flex',
      width: '-webkit-fill-available',
      gap: theme.spacing(1),

      '> div': {
        width: 'auto',
      },
    }),
  };
};
