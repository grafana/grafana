import { css } from '@emotion/css';
import { defaults } from 'lodash';
import { useState } from 'react';

import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, InlineLabel, useStyles2 } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

import { TempoQueryBuilderOptions } from './TempoQueryBuilderOptions';
import { TraceQLEditor } from './TraceQLEditor';

type EditorProps = {
  onClearResults: () => void;
};

type Props = EditorProps & QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function QueryEditor(props: Props) {
  const styles = useStyles2(getStyles);
  const query = defaults(props.query, defaultQuery);
  const [showCopyFromSearchButton, setShowCopyFromSearchButton] = useState(() => {
    const genQuery = props.datasource.languageProvider.generateQueryFromFilters(query.filters || []);
    return genQuery === query.query || genQuery === '{}';
  });

  return (
    <>
      <InlineLabel>
        Build complex queries using TraceQL to select a list of traces.{' '}
        <a rel="noreferrer" target="_blank" href="https://grafana.com/docs/tempo/latest/traceql/">
          Documentation
        </a>
      </InlineLabel>
      {!showCopyFromSearchButton && (
        <div className={styles.copyContainer}>
          <span>Continue editing the query from the Search tab?</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reportInteraction('grafana_traces_copy_to_traceql_clicked', {
                app: props.app ?? '',
                grafana_version: config.buildInfo.version,
                location: 'traceql_tab',
              });

              props.onClearResults();
              props.onChange({
                ...query,
                query: props.datasource.languageProvider.generateQueryFromFilters(query.filters || []),
              });
              setShowCopyFromSearchButton(true);
            }}
            style={{ marginLeft: '10px' }}
          >
            Copy query from Search
          </Button>
        </div>
      )}
      <TraceQLEditor
        placeholder="Enter a TraceQL query or trace ID (run with Shift+Enter)"
        query={query}
        onChange={props.onChange}
        datasource={props.datasource}
        onRunQuery={props.onRunQuery}
      />
      <div className={styles.optionsContainer}>
        <TempoQueryBuilderOptions
          query={query}
          onChange={props.onChange}
          searchStreaming={props.datasource.isStreamingSearchEnabled() ?? false}
          metricsStreaming={props.datasource.isStreamingMetricsEnabled() ?? false}
        />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  optionsContainer: css({
    marginTop: '10px',
  }),
  copyContainer: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(0.5, 1),
    fontSize: theme.typography.body.fontSize,
  }),
});
