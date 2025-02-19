import { css } from '@emotion/css';
import Prism from 'prismjs';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Collapse, useStyles2, Text } from '@grafana/ui';
import { flattenTokens } from '@grafana/ui/src/slate-plugins/slate-prism';

import { trackSampleQuerySelection } from '../../tracking';
import { CloudWatchLogsQuery, CloudWatchQuery, LogsQueryLanguage } from '../../types';

import * as sampleQueries from './sampleQueries';
import { cwliTokenizer, pplTokenizer, sqlTokenizer } from './tokenizer';

interface QueryExample {
  category: string;
  examples: sampleQueries.SampleQuery[];
}

const QUERIES: QueryExample[] = [
  {
    category: 'General queries',
    examples: sampleQueries.generalQueries,
  },
  {
    category: 'Lambda',
    examples: sampleQueries.lambdaSamples,
  },

  {
    category: 'VPC Flow Logs',
    examples: sampleQueries.vpcSamples,
  },
  {
    category: 'CloudTrail Logs',
    examples: sampleQueries.cloudtrailSamples,
  },
  {
    category: 'NAT Gateway',
    examples: sampleQueries.natSamples,
  },
  {
    category: 'AWS App Sync',
    examples: sampleQueries.appSyncSamples,
  },
  {
    category: 'IOT queries',
    examples: sampleQueries.iotSamples,
  },
];

function renderHighlightedMarkup(
  code: string,
  keyPrefix: string,
  queryLanugage: LogsQueryLanguage = LogsQueryLanguage.CWLI
) {
  const grammar = getGrammarForLanguage(queryLanugage);
  const tokens = flattenTokens(Prism.tokenize(code, grammar));
  const spans = tokens
    .filter((token) => typeof token !== 'string')
    .map((token, i) => {
      return (
        <span
          className={`prism-token token ${token.types.join(' ')} ${token.aliases.join(' ')}`}
          key={`${keyPrefix}-token-${i}`}
        >
          {token.content}
        </span>
      );
    });

  return <div className="slate-query-field">{spans}</div>;
}

interface CollapseProps {
  key?: string;
  label: string;
  children: React.ReactNode;
}
const CheatSheetCollapse = (props: CollapseProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Collapse label={props.label} isOpen={isOpen} onToggle={setIsOpen} key={props.key} collapsible>
      {props.children}
    </Collapse>
  );
};

type Props = {
  onClickExample: (query: CloudWatchQuery) => void;
  query: CloudWatchQuery;
};
const isLogsQuery = (query: CloudWatchQuery): query is CloudWatchLogsQuery => query.queryMode === 'Logs';

const LogsCheatSheet = (props: Props) => {
  const styles = useStyles2(getStyles);
  const queryLanguage: LogsQueryLanguage =
    (isLogsQuery(props.query) && props.query.queryLanguage) || LogsQueryLanguage.CWLI;

  const onClickExample = (query: sampleQueries.SampleQuery, queryCategory: string) => {
    props.onClickExample({
      ...props.query,
      refId: props.query.refId ?? 'A',
      expression: query.expr[queryLanguage],
      queryMode: 'Logs',
      region: props.query.region,
      id: props.query.refId ?? 'A',
      logGroupNames: 'logGroupNames' in props.query ? props.query.logGroupNames : [],
      logGroups: 'logGroups' in props.query ? props.query.logGroups : [],
    });
    trackSampleQuerySelection({ queryLanguage, queryCategory });
  };

  return (
    <div>
      <div className={styles.heading}>
        <Text variant="h3" weight="bold">
          CloudWatch Logs cheat sheet
        </Text>
      </div>
      {QUERIES.map((query, i) => (
        <CheatSheetCollapse key={query.category} label={query.category}>
          <div key={`cat-${i}`}>
            {query.examples.map((item, j) => (
              <>
                {item.expr[queryLanguage] && (
                  <>
                    <Text variant="h6" weight="bold">
                      {item.title}
                    </Text>
                    <button
                      type="button"
                      className={styles.cheatSheetExample}
                      key={item.expr[queryLanguage]}
                      onClick={() => onClickExample(item, query.category)}
                    >
                      <pre>{renderHighlightedMarkup(item.expr[queryLanguage], `item-${j}`, queryLanguage)}</pre>
                    </button>
                  </>
                )}
              </>
            ))}
          </div>
        </CheatSheetCollapse>
      ))}
      <div>
        Note: If you are seeing masked data, you may have CloudWatch logs data protection enabled.{' '}
        <a
          className={styles.link}
          href="https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/#cloudwatch-logs-data-protection"
          target="_blank"
          rel="noreferrer"
        >
          See documentation for details
        </a>
        .
      </div>
    </div>
  );
};

export default LogsCheatSheet;

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    marginBottom: theme.spacing(2),
  }),
  link: css({
    textDecoration: 'underline',
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

const getGrammarForLanguage = (queryLanugage: LogsQueryLanguage) => {
  switch (queryLanugage) {
    case LogsQueryLanguage.CWLI:
      return cwliTokenizer;
    case LogsQueryLanguage.PPL:
      return pplTokenizer;
    case LogsQueryLanguage.SQL:
      return sqlTokenizer;
  }
};
