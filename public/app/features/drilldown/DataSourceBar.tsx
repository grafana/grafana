import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Field, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { SIGNALS, SIGNAL_TYPES, type Signal, dataSourceParam, suggestDataSources } from './dataSources';

// On first load, writes the related data sources for every signal the URL leaves open into the URL, so the URL
// always names the data sources in use. Returns true once that is done, so a view loads once with its final choice.
export function useFilledDataSources(): boolean {
  const [, updateQueryParams] = useQueryParams();
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fill = async () => {
      const suggestion = await suggestDataSources().catch((): Awaited<ReturnType<typeof suggestDataSources>> => ({}));
      const values: Record<string, string> = {};
      for (const signal of SIGNALS) {
        const uid = suggestion[signal];
        if (uid) {
          values[dataSourceParam(signal)] = uid;
        }
      }
      if (!cancelled) {
        if (Object.keys(values).length > 0) {
          updateQueryParams(values, true);
        }
        setFilled(true);
      }
    };
    fill();
    return () => {
      cancelled = true;
    };
  }, [updateQueryParams]);

  return filled;
}

// The key changes with any chosen data source, so a view remounts and reloads when one changes.
export function dataSourcesKey(queryParams: Record<string, unknown>): string {
  return SIGNALS.map((signal) => String(queryParams[dataSourceParam(signal)] ?? '')).join('|');
}

export function signalLabels(): Record<Signal, string> {
  return {
    metrics: t('drilldown-datasources.metrics', 'Metrics'),
    logs: t('drilldown-datasources.logs', 'Logs'),
    traces: t('drilldown-datasources.traces', 'Traces'),
    profiles: t('drilldown-datasources.profiles', 'Profiles'),
    knowledgegraph: t('drilldown-datasources.knowledgegraph', 'Knowledge graph'),
    sql: t('drilldown-datasources.sql', 'SQL'),
  };
}

export function DataSourceBar() {
  const styles = useStyles2(getStyles);
  const [queryParams, updateQueryParams] = useQueryParams();
  const labels = signalLabels();

  return (
    <div className={styles.bar}>
      {SIGNALS.map((signal) => {
        const current = queryParams[dataSourceParam(signal)];
        const inputId = `drilldown-data-source-${signal}`;
        return (
          <Field key={signal} label={labels[signal]} htmlFor={inputId} noMargin>
            <DataSourcePicker
              inputId={inputId}
              type={SIGNAL_TYPES[signal]}
              current={typeof current === 'string' ? current : null}
              noDefault
              width={30}
              onChange={(dataSource) => updateQueryParams({ [dataSourceParam(signal)]: dataSource.uid })}
            />
          </Field>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 2, 0),
  }),
});
