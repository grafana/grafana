import React, { PureComponent } from 'react';
import { stripIndent, stripIndents } from 'common-tags';
import { ExploreStartPageProps, DataQuery, ExploreMode } from '@grafana/data';
import Prism from 'prismjs';
import tokenizer from '../syntax';
import { flattenTokens } from '@grafana/ui/src/slate-plugins/slate-prism';

const CLIQ_EXAMPLES = [
  {
    title: 'View latency statistics for 5-minute intervals',
    expr: stripIndents`filter @type = "REPORT" |
                             stats avg(@duration), max(@duration), min(@duration) by bin(5m)`,
  },
  {
    title: 'Determine the amount of overprovisioned memory',
    expr: stripIndent`
    filter @type = "REPORT" |
    stats max(@memorySize / 1024 / 1024) as provisonedMemoryMB,
          min(@maxMemoryUsed / 1024 / 1024) as smallestMemoryRequestMB,
          avg(@maxMemoryUsed / 1024 / 1024) as avgMemoryUsedMB,
          max(@maxMemoryUsed / 1024 / 1024) as maxMemoryUsedMB,
          provisonedMemoryMB - maxMemoryUsedMB as overProvisionedMB`,
  },
  {
    title: 'Find the most expensive requests',
    expr: stripIndents`filter @type = "REPORT" |
                             fields @requestId, @billedDuration | sort by @billedDuration desc`,
  },
  {
    title: 'Average, min, and max byte transfers by source and destination IP addresses',
    expr: `stats avg(bytes), min(bytes), max(bytes) by srcAddr, dstAddr`,
  },
  {
    title: 'IP addresses using UDP transfer protocol',
    expr: 'filter protocol=17 | stats count(*) by srcAddr',
  },
  {
    title: 'Top 10 byte transfers by source and destination IP addresses',
    expr: stripIndents`stats sum(bytes) as bytesTransferred by srcAddr, dstAddr |
                             sort bytesTransferred desc |
                             limit 10`,
  },
  {
    title: 'Top 20 source IP addresses with highest number of rejected requests',
    expr: stripIndents`filter action="REJECT" |
                             stats count(*) as numRejections by srcAddr |
                             sort numRejections desc |
                             limit 20`,
  },
  {
    title: 'Number of log entries by service, event type, and region',
    expr: 'stats count(*) by eventSource, eventName, awsRegion',
  },

  {
    title: 'Number of log entries by region and EC2 event type',
    expr: stripIndents`filter eventSource="ec2.amazonaws.com" |
                             stats count(*) as eventCount by eventName, awsRegion |
                             sort eventCount desc`,
  },

  {
    title: 'Regions, usernames, and ARNs of newly created IAM users',
    expr: stripIndents`filter eventName="CreateUser" |
                             fields awsRegion, requestParameters.userName, responseElements.user.arn`,
  },
  {
    title: '25 most recently added log events',
    expr: stripIndents`fields @timestamp, @message |
                             sort @timestamp desc |
                             limit 25`,
  },
  {
    title: 'Number of exceptions logged every 5 minutes',
    expr: stripIndents`filter @message like /Exception/ |
                            stats count(*) as exceptionCount by bin(5m) |
                            sort exceptionCount desc`,
  },
  {
    title: 'List of log events that are not exceptions',
    expr: 'fields @message | filter @message not like /Exception/',
  },
];

function renderHighlightedMarkup(code: string, keyPrefix: string) {
  const grammar = Prism.languages['cloudwatch'] ?? tokenizer;
  const tokens = flattenTokens(Prism.tokenize(code, grammar));
  const spans = tokens
    .filter(token => typeof token !== 'string')
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

export default class LogsCheatSheet extends PureComponent<ExploreStartPageProps, { userExamples: string[] }> {
  renderExpression(expr: string, keyPrefix: string) {
    const { onClickExample } = this.props;

    return (
      <div
        className="cheat-sheet-item__example"
        key={expr}
        onClick={e => onClickExample({ refId: 'A', expression: expr } as DataQuery)}
      >
        <pre>{renderHighlightedMarkup(expr, keyPrefix)}</pre>
      </div>
    );
  }

  renderLogsCheatSheet() {
    return (
      <div>
        <h2>CloudWatch Logs Cheat Sheet</h2>
        {CLIQ_EXAMPLES.map((item, i) => (
          <div className="cheat-sheet-item" key={`item-${i}`}>
            <div className="cheat-sheet-item__title">{item.title}</div>
            {this.renderExpression(item.expr, `item-${i}`)}
          </div>
        ))}
      </div>
    );
  }

  render() {
    const { exploreMode } = this.props;

    return exploreMode === ExploreMode.Logs && this.renderLogsCheatSheet();
  }
}
