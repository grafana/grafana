import { css, cx } from '@emotion/css';
import { stripIndent, stripIndents } from 'common-tags';
import Prism from 'prismjs';
import React, { useState } from 'react';

import { Collapse } from '@grafana/ui';
import { flattenTokens } from '@grafana/ui/src/slate-plugins/slate-prism';

import tokenizer from '../language/cloudwatch-logs/syntax';
import { CloudWatchQuery } from '../types';

interface QueryExample {
  category: string;
  examples: Array<{
    title?: string;
    description?: string;
    expr: string;
  }>;
}

const QUERIES: QueryExample[] = [
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
        expr: stripIndent`filter @type = "REPORT"
        | stats max(@memorySize / 1000 / 1000) as provisionedMemoryMB,
          min(@maxMemoryUsed / 1000 / 1000) as smallestMemoryRequestMB,
          avg(@maxMemoryUsed / 1000 / 1000) as avgMemoryUsedMB,
          max(@maxMemoryUsed / 1000 / 1000) as maxMemoryUsedMB,
          provisionedMemoryMB - maxMemoryUsedMB as overProvisionedMB
        `,
      },
      {
        title: 'Find the most expensive requests',
        expr: stripIndents`filter @type = "REPORT"
        | fields @requestId, @billedDuration
        | sort by @billedDuration desc`,
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
      {
        title: 'Find the top 15 packet transfers across hosts',
        expr: stripIndents`stats sum(packets) as packetsTransferred by srcAddr, dstAddr
        | sort packetsTransferred  desc
        | limit 15`,
      },
      {
        title: 'Find the IP addresses where flow records were skipped during the capture window',
        expr: stripIndents`filter logStatus="SKIPDATA"
        | stats count(*) by bin(1h) as t
        | sort t`,
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
      {
        title: 'Find EC2 hosts that were started or stopped in a given AWS Region',
        expr: stripIndents`filter (eventName="StartInstances" or eventName="StopInstances") and region="us-east-2"`,
      },
      {
        title: 'Find the number of records where an exception occurred while invoking the UpdateTrail API',
        expr: stripIndents`filter eventName="UpdateTrail" and ispresent(errorCode) | stats count(*) by errorCode, errorMessage`,
      },
      {
        title: 'Find log entries where TLS 1.0 or 1.1 was used',
        expr: stripIndents`filter tlsDetails.tlsVersion in [ "TLSv1", "TLSv1.1" ]
        | stats count(*) as numOutdatedTlsCalls by userIdentity.accountId, recipientAccountId, eventSource, eventName, awsRegion, tlsDetails.tlsVersion, tlsDetails.cipherSuite, userAgent
        | sort eventSource, eventName, awsRegion, tlsDetails.tlsVersion`,
      },
      {
        title: 'Find the number of calls per service that used TLS versions 1.0 or 1.1',
        expr: stripIndents`filter tlsDetails.tlsVersion in [ "TLSv1", "TLSv1.1" ]
        | stats count(*) as numOutdatedTlsCalls by eventSource
        | sort numOutdatedTlsCalls desc`,
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
      {
        title: 'To parse and count fields',
        expr: stripIndents`fields @timestamp, @message
        | filter @message like /User ID/
        | parse @message "User ID: *" as @userId
        | stats count(*) by @userId`,
      },
      {
        title: 'To Identify faults on any API calls',
        expr: stripIndents`filter Operation = <operation> AND Fault > 0
        | fields @timestamp, @logStream as instanceId, ExceptionMessage`,
      },
      {
        title:
          'To get the number of exceptions logged every 5 minutes using regex where exception is not case sensitive',
        expr: stripIndents`filter @message like /(?i)Exception/
        | stats count(*) as exceptionCount by bin(5m)
        | sort exceptionCount desc`,
      },
      {
        title: 'To parse ephemeral fields using a glob expression',
        expr: stripIndents`parse @message "user=*, method:*, latency := *" as @user, @method, @latency
        | stats avg(@latency) by @method, @user`,
      },
      {
        title: 'To parse ephemeral fields using a glob expression using regular expression',
        expr: stripIndents`parse @message /user=(?<user2>.*?), method:(?<method2>.*?), latency := (?<latency2>.*?)/
        | stats avg(latency2) by @method2, @user2`,
      },
      {
        title: 'To extract ephemeral fields and display field for events that contain an ERROR string',
        expr: stripIndents`fields @message
        | parse @message "* [*] *" as loggingTime, loggingType, loggingMessage
        | filter loggingType IN ["ERROR"]
        | display loggingMessage, loggingType = "ERROR" as isError`,
      },
      {
        title: 'To trim whitespaces from query results',
        expr: stripIndents`fields trim(@message) as trimmedMessage
        | parse trimmedMessage "[*] * * Retrieving CloudWatch Metrics for AccountID : *, CloudWatch Metric : *, Resource Type : *, ResourceID : *" as level, time, logId, accountId, metric, type, resourceId
        | display level, time, logId, accountId, metric, type, resourceId
        | filter level like "INFO"`,
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
        title: 'Top 10 DNS resolver IPs with highest number of requests',
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

const COMMANDS: QueryExample[] = [
  {
    category: 'fields',
    examples: [
      {
        description:
          'Retrieve one or more log fields. You can also use functions and operations such as abs(a+b), sqrt(a/b), log(a)+log(b), strlen(trim()), datefloor(), isPresent(), and others in this command.',
        expr: 'fields @log, @logStream, @message, @timestamp',
      },
    ],
  },
  {
    category: 'filter',
    examples: [
      {
        description:
          'Retrieve log fields based on one or more conditions. You can use comparison operators such as =, !=, >, >=, <, <=, boolean operators such as and, or, and not, and regular expressions in this command.',
        expr: 'filter @message like /(?i)(Exception|error|fail|5dd)/',
      },
    ],
  },
  {
    category: 'stats',
    examples: [
      {
        description: 'Calculate aggregate statistics such as sum(), avg(), count(), min() and max() for log fields.',
        expr: 'stats count() by bin(5m)',
      },
    ],
  },
  {
    category: 'sort',
    examples: [
      {
        description: 'Sort the log fields in ascending or descending order.',
        expr: 'sort @timestamp asc',
      },
    ],
  },
  {
    category: 'limit',
    examples: [
      {
        description: 'Limit the number of log events returned by a query.',
        expr: 'limit 10',
      },
    ],
  },
  {
    category: 'parse',
    examples: [
      {
        description:
          'Create one or more ephemeral fields, which can be further processed by the query. The following example will extract the ephemeral fields host, identity, dateTimeString, httpVerb, url, protocol, statusCode, bytes from @message, and return the url, max(bytes), and avg(bytes) fields sorted by max(bytes) in descending order.',
        expr: stripIndents`parse '* - * [*] "* * *" * *' as host, identity, dateTimeString, httpVerb, url, protocol, statusCode, bytes
        | stats max(bytes) as maxBytes, avg(bytes) by url
        | sort maxBytes desc`,
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

type Props = {
  onClickExample: (query: CloudWatchQuery) => void;
  query: CloudWatchQuery;
};

const LogsCheatSheet = (props: Props) => {
  const [isCommandsOpen, setIsCommandsOpen] = useState(false);
  const [isQueriesOpen, setIsQueriesOpen] = useState(false);

  return (
    <div>
      <h3>CloudWatch Logs cheat sheet</h3>
      <Collapse
        label="Commands"
        collapsible={true}
        isOpen={isCommandsOpen}
        onToggle={(isOpen) => setIsCommandsOpen(isOpen)}
      >
        <>
          {COMMANDS.map((cat, i) => (
            <div key={`cat-${i}`}>
              <h5>{cat.category}</h5>
              {cat.examples.map((item, j) => (
                <div key={`item-${j}`}>
                  <p>{item.description}</p>
                  <button
                    type="button"
                    className="cheat-sheet-item__example"
                    key={item.expr}
                    onClick={() =>
                      props.onClickExample({
                        refId: props.query.refId ?? 'A',
                        expression: item.expr,
                        queryMode: 'Logs',
                        region: props.query.region,
                        id: props.query.refId ?? 'A',
                        logGroupNames: 'logGroupNames' in props.query ? props.query.logGroupNames : [],
                        logGroups: 'logGroups' in props.query ? props.query.logGroups : [],
                      })
                    }
                  >
                    <pre>{renderHighlightedMarkup(item.expr, `item-${j}`)}</pre>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </>
      </Collapse>
      <Collapse
        label="Queries"
        collapsible={true}
        isOpen={isQueriesOpen}
        onToggle={(isOpen) => setIsQueriesOpen(isOpen)}
      >
        {QUERIES.map((cat, i) => (
          <div key={`cat-${i}`}>
            <div className={`cheat-sheet-item__title ${cx(exampleCategory)}`}>{cat.category}</div>
            {cat.examples.map((item, j) => (
              <div className="cheat-sheet-item" key={`item-${j}`}>
                <h4>{item.title}</h4>
                <button
                  type="button"
                  className="cheat-sheet-item__example"
                  key={item.expr}
                  onClick={() =>
                    props.onClickExample({
                      refId: props.query.refId ?? 'A',
                      expression: item.expr,
                      queryMode: 'Logs',
                      region: props.query.region,
                      id: props.query.refId ?? 'A',
                      logGroupNames: 'logGroupNames' in props.query ? props.query.logGroupNames : [],
                      logGroups: 'logGroups' in props.query ? props.query.logGroups : [],
                    })
                  }
                >
                  <pre>{renderHighlightedMarkup(item.expr, `item-${j}`)}</pre>
                </button>
              </div>
            ))}
          </div>
        ))}
      </Collapse>
      <div>
        Note: If you are seeing masked data, you may have CloudWatch logs data protection enabled.{' '}
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
};

export default LogsCheatSheet;
