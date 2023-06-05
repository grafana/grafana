import { css, cx } from '@emotion/css';
import { stripIndent, stripIndents } from 'common-tags';
import Prism from 'prismjs';
import React, { PureComponent } from 'react';

import { QueryEditorHelpProps } from '@grafana/data';
import { flattenTokens } from '@grafana/ui/src/slate-plugins/slate-prism';

import tokenizer from '../language/cloudwatch-logs/syntax';
import { CloudWatchQuery } from '../types';

interface QueryExample {
  category: string;
  examples: Array<{
    title: string;
    expr: string;
  }>;
}

const CLIQ_EXAMPLES: QueryExample[] = [
  {
    category: 'Lambda',
    examples: [
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
                           fields @requestId, @billedDuration |
                           sort by @billedDuration desc`,
      },
    ],
  },

  {
    category: 'VPC Flow Logs',
    examples: [
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
    ],
  },
  {
    category: 'CloudTrail',
    examples: [
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
    ],
  },
  {
    category: 'Common Queries',
    examples: [
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
    ],
  },
  {
    category: 'Route 53',
    examples: [
      {
        title: 'Number of requests received every 10  minutes by edge location',
        expr: 'stats count(*) by queryType, bin(10m)',
      },
      {
        title: 'Number of unsuccessful requests by domain',
        expr: 'filter responseCode="SERVFAIL" | stats count(*) by queryName',
      },
      {
        title: 'Number of requests received every 10  minutes by edge location',
        expr: 'stats count(*) as numRequests by resolverIp | sort numRequests desc | limit 10',
      },
    ],
  },
  {
    category: 'AWS AppSync',
    examples: [
      {
        title: 'Number of unique HTTP status codes',
        expr: stripIndents`fields ispresent(graphQLAPIId) as isApi |
                           filter isApi |
                           filter logType = "RequestSummary" |
                           stats count() as statusCount by statusCode |
                           sort statusCount desc`,
      },
      {
        title: 'Top 10 resolvers with maximum latency',
        expr: stripIndents`fields resolverArn, duration |
                           filter logType = "Tracing" |
                           sort duration desc |
                           limit 10`,
      },
      {
        title: 'Most frequently invoked resolvers',
        expr: stripIndents`fields ispresent(resolverArn) as isRes |
                           stats count() as invocationCount by resolverArn |
                           filter isRes |
                           filter logType = "Tracing" |
                           sort invocationCount desc |
                           limit 10`,
      },
      {
        title: 'Resolvers with most errors in mapping templates',
        expr: stripIndents`fields ispresent(resolverArn) as isRes |
                           stats count() as errorCount by resolverArn, logType |
                           filter isRes and (logType = "RequestMapping" or logType = "ResponseMapping") and fieldInError |
                           sort errorCount desc |
                           limit 10`,
      },
      {
        title: 'Field latency statistics',
        expr: stripIndents`fields requestId, latency |
                           filter logType = "RequestSummary" |
                           sort latency desc |
                           limit 10`,
      },
      {
        title: 'Resolver latency statistics',
        expr: stripIndents`fields ispresent(resolverArn) as isRes |
                           filter isRes |
                           filter logType = "Tracing" |
                           stats min(duration), max(duration), avg(duration) as avgDur by resolverArn |
                           sort avgDur desc |
                           limit 10`,
      },
      {
        title: 'Top 10 requests with maximum latency',
        expr: stripIndents`fields requestId, latency |
                           filter logType = "RequestSummary" |
                           sort latency desc |
                           limit 10`,
      },
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

const exampleCategory = css`
  margin-top: 5px;
`;

const link = css`
  text-decoration: underline;
`;

export default class LogsCheatSheet extends PureComponent<
  QueryEditorHelpProps<CloudWatchQuery>,
  { userExamples: string[] }
> {
  onClickExample(query: CloudWatchQuery) {
    this.props.onClickExample(query);
  }
  renderExpression(expr: string, keyPrefix: string) {
    return (
      <button
        type="button"
        className="cheat-sheet-item__example"
        key={expr}
        onClick={() =>
          this.onClickExample({
            refId: this.props.query.refId ?? 'A',
            expression: expr,
            queryMode: 'Logs',
            region: this.props.query.region,
            id: this.props.query.refId ?? 'A',
            logGroupNames: 'logGroupNames' in this.props.query ? this.props.query.logGroupNames : [],
            logGroups: 'logGroups' in this.props.query ? this.props.query.logGroups : [],
          })
        }
      >
        <pre>{renderHighlightedMarkup(expr, keyPrefix)}</pre>
      </button>
    );
  }

  renderLogsCheatSheet() {
    return (
      <div>
        <h2>CloudWatch Logs Cheat Sheet</h2>
        {CLIQ_EXAMPLES.map((cat, i) => (
          <div key={`${cat.category}-${i}`}>
            <div className={`cheat-sheet-item__title ${cx(exampleCategory)}`}>{cat.category}</div>
            {cat.examples.map((item, j) => (
              <div className="cheat-sheet-item" key={`item-${j}`}>
                <h4>{item.title}</h4>
                {this.renderExpression(item.expr, `item-${j}`)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  render() {
    return (
      <div>
        <h3>CloudWatch Logs cheat sheet</h3>
        {CLIQ_EXAMPLES.map((cat, i) => (
          <div key={`cat-${i}`}>
            <div className={`cheat-sheet-item__title ${cx(exampleCategory)}`}>{cat.category}</div>
            {cat.examples.map((item, j) => (
              <div className="cheat-sheet-item" key={`item-${j}`}>
                <h4>{item.title}</h4>
                {this.renderExpression(item.expr, `item-${j}`)}
              </div>
            ))}
          </div>
        ))}
        <div>
          If you are seeing masked data, you may have CloudWatch logs data protection enabled.{' '}
          <a
            className={cx(link)}
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
  }
}
