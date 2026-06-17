import { css } from '@emotion/css';
import { shuffle } from 'lodash';
import { memo, useState, useEffect } from 'react';

import { type GrafanaTheme2, type QueryEditorHelpProps } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { TextLink, useStyles2 } from '@grafana/ui';

import type LokiLanguageProvider from '../LanguageProvider';
import { escapeLabelValueInExactSelector } from '../languageUtils';
import { type LokiQuery } from '../types';

const DEFAULT_EXAMPLES = ['{job="default/prometheus"}'];
const PREFERRED_LABELS = ['job', 'app', 'k8s_app'];
const EXAMPLES_LIMIT = 5;

const LOGQL_EXAMPLES = [
  {
    title: 'Log pipeline',
    expression: '{job="mysql"} |= "metrics" | logfmt | duration > 10s',
    label:
      'This query targets the MySQL job, keeps logs that contain the substring "metrics", and then parses and filters the logs further.',
  },
  {
    title: 'Count over time',
    expression: 'count_over_time({job="mysql"}[5m])',
    label: 'This query counts all the log lines within the last five minutes for the MySQL job.',
  },
  {
    title: 'Rate',
    expression: 'rate(({job="mysql"} |= "error" != "timeout")[10s])',
    label:
      'This query gets the per-second rate of all non-timeout errors within the last ten seconds for the MySQL job.',
  },
  {
    title: 'Aggregate, count, and group',
    expression: 'sum(count_over_time({job="mysql"}[5m])) by (level)',
    label: 'Get the count of logs during the last five minutes, grouping by level.',
  },
];

export default memo(function LokiCheatSheet({ datasource, onClickExample }: QueryEditorHelpProps<LokiQuery>) {
  const styles = useStyles2(getStyles);
  const [userExamples, setUserExamples] = useState<string[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const checkUserLabels = async () => {
      const provider: LokiLanguageProvider = datasource?.languageProvider;
      if (provider.started) {
        const labels = provider.getLabelKeys() || [];
        const preferredLabel = PREFERRED_LABELS.find((l) => labels.includes(l));
        if (preferredLabel) {
          const values = await provider.fetchLabelValues(preferredLabel);
          setUserExamples(
            shuffle(values)
              .slice(0, EXAMPLES_LIMIT)
              .map((value) => `{${preferredLabel}="${escapeLabelValueInExactSelector(value)}"}`)
          );
        }
      } else {
        timer = setTimeout(checkUserLabels, 1000);
      }
    };

    reportInteraction('grafana_loki_cheatsheet_opened', {});
    timer = setTimeout(checkUserLabels, 1000);

    return () => clearTimeout(timer);
  }, [datasource]);

  function renderExpression(expr: string) {
    return (
      <button
        type="button"
        className={styles.cheatSheetExample}
        key={expr}
        onClick={() => {
          onClickExample({ refId: 'A', expr });
          reportInteraction('grafana_loki_cheatsheet_example_clicked', {});
        }}
      >
        <code>{expr}</code>
      </button>
    );
  }

  const hasUserExamples = userExamples.length > 0;

  return (
    <div>
      <h2>Loki Cheat Sheet</h2>
      <div className={styles.cheatSheetItem}>
        <div className={styles.cheatSheetItemTitle}>See your logs</div>
        Start by selecting a log stream from the Label browser, or alternatively you can write a stream selector into
        the query field.
        {hasUserExamples ? (
          <div>
            Here are some example streams from your logs:
            {userExamples.map((example) => renderExpression(example))}
          </div>
        ) : (
          <div>
            Here is an example of a log stream:
            {renderExpression(DEFAULT_EXAMPLES[0])}
          </div>
        )}
      </div>
      <div className={styles.cheatSheetItem}>
        <div className={styles.cheatSheetItemTitle}>Combine stream selectors</div>
        {renderExpression('{app="cassandra",namespace="prod"}')}
        Returns all log lines from streams that have both labels.
      </div>

      <div className={styles.cheatSheetItem}>
        <div className={styles.cheatSheetItemTitle}>Filtering for search terms.</div>
        {renderExpression('{app="cassandra"} |~ "(duration|latency)s*(=|is|of)s*[d.]+"')}
        {renderExpression('{app="cassandra"} |= "exact match"')}
        {renderExpression('{app="cassandra"} != "do not match"')}
        <TextLink href="https://grafana.com/docs/loki/latest/logql/#log-pipeline" external>
          LogQL
        </TextLink>{' '}
        supports exact and regular expression filters.
      </div>
      {LOGQL_EXAMPLES.map((item) => (
        <div className={styles.cheatSheetItem} key={item.expression}>
          <div className={styles.cheatSheetItemTitle}>{item.title}</div>
          {renderExpression(item.expression)}
          {item.label}
        </div>
      ))}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  cheatSheetItem: css({
    margin: theme.spacing(3, 0),
  }),
  cheatSheetItemTitle: css({
    fontSize: theme.typography.h3.fontSize,
  }),
  cheatSheetExample: css({
    margin: theme.spacing(0.5, 0),
    // element is interactive, clear button styles
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    display: 'block',
  }),
});
