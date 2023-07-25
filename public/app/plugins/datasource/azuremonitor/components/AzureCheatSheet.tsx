// import { css } from '@emotion/css';
import { stripIndent, stripIndents } from 'common-tags';
import Prism from 'prismjs';
import React, { useState } from 'react';

import { Button, Collapse } from '@grafana/ui';
import { flattenTokens } from '@grafana/ui/src/slate-plugins/slate-prism';

import tokenizer from '../../cloudwatch/language/cloudwatch-logs/syntax';
import { AzureMonitorQuery, AzureQueryType } from '../types';

interface QueryExample {
  examples: Array<{
    title?: string;
    description?: string;
    expr: string;
  }>;
}

const LOGS: QueryExample[] = [
  {
    examples: [
      {
        title: 'View CPU performance of a virtual machine over 5ms time grains',
        expr: stripIndents`Perf
        # $__timeFilter is a special Grafana macro that filters the results to the time span of the dashboard
        | where $__timeFilter(TimeGenerated)
        | where CounterName == "% Processor Time"
        | summarize avg(CounterValue) by bin(TimeGenerated, 5m), Computer
        | order by TimeGenerated asc
        `,
      },
      {
        title: 'Determine the amount of overprovisioned memory',
        expr: stripIndent`filter @type = "REPORT"
        | stats max(@memorySize / 1000 / 1000) as provisionedMemoryMB,
          min(@maxMemoryUsed / 1000 / 1000) as smallestMemoryRequestMB,
          avg(@maxMemoryUsed / 1000 / 1000) as avgMemoryUsedMB,
          max(@maxMemoryUsed / 1000 / 1000) as maxMemoryUsedMB,
          provisionedMemoryMB - maxMemoryUsedMB as overProvisionedMB
        `,
      },
      // {
      //   title: 'Find the most expensive requests',
      //   expr: stripIndents`filter @type = "REPORT"
      //   | fields @requestId, @billedDuration
      //   | sort by @billedDuration desc`,
      // },
    ],
  },
];

function renderHighlightedMarkup(code: string, keyPrefix: string) {
  const grammar = tokenizer;
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

// const exampleCategory = css`
//   margin-top: 5px;
// `;

// const link = css`
//   text-decoration: underline;
// `;

type Props = {
  onClickExample: (query: AzureMonitorQuery) => void;
  query: AzureMonitorQuery;
};

const AzureCheatSheet = (props: Props) => {
  //   const [isCommandsOpen, setIsCommandsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  return (
    <div>
      <h3>Azure Monitor cheat sheet</h3>
      <Collapse label="Logs" collapsible={true} isOpen={isLogsOpen} onToggle={(isOpen) => setIsLogsOpen(isOpen)}>
        {LOGS.map((cat, i) => (
          <div key={`cat-${i}`}>
            {cat.examples.map((item, j) => (
              <div className="cheat-sheet-item" key={`item-${j}`}>
                <h5>{item.title}</h5>
                <pre>{renderHighlightedMarkup(item.expr, `item-${j}`)}</pre>
                {props.query.queryType === AzureQueryType.LogAnalytics && (
                  <Button
                    size="sm"
                    aria-label="use this query button"
                    type="button"
                    className="cheat-sheet-item__example"
                    key={item.expr}
                    onClick={(e) => {
                      e.preventDefault();
                      console.log(item.expr);
                      console.log('button query', props.query);
                      // props.datasource.components.QueryEditor.defaultProps.onChange(item.expr)
                      props.onClickExample({
                        refId: props.query.refId ?? 'A',
                        queryType: AzureQueryType.LogAnalytics,
                      });
                    }}
                  >
                    Use this query
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </Collapse>
    </div>
  );
};

export default AzureCheatSheet;
