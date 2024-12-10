import { stripIndents } from 'common-tags';

import { LogsQueryLanguage } from '../../types';

export interface SampleQuery {
  title: string;
  expr: Partial<Record<LogsQueryLanguage, string>>;
}

const sqlOnlyGeneralQueries: SampleQuery[] = [
  {
    title:
      'Use the JOIN command to match events between two log groups (LogGroupA, LogGroupB), based on common user IDs across the logs. ',
    expr: {
      SQL: stripIndents`SELECT A.transaction_id as txn_id_a, A.userId , A.instance_id as inst_id_a, B.instance_id as inst_id_b FROM \`LogGroupA\` as A INNER JOIN \`LogGroupB\` as B ON A.userId = B.userId WHERE B.Status='ERROR'`,
    },
  },
  {
    title: 'Find logs where duration is greater than the average duration of all log groups, using a sub-query',
    expr: {
      SQL: stripIndents`SELECT \`@duration\` FROM \`LogGroupA\`
 WHERE \`@duration\` > (
 SELECT avg(\`@duration\`) FROM \`LogGroupA\`
 WHERE \`@type\` = 'REPORT')`,
    },
  },
  {
    title:
      'Find all logs relating to a Lambda function where level is ERROR, and order these logs by request id using a sub-query',
    expr: {
      SQL: stripIndents`select requestId, level, \`@timestamp\`, \`@message\` from \`LogGroupA\` where requestId IN (SELECT distinct
  requestId FROM \`LogGroupA\` where level = 'ERROR') order by requestId`,
    },
  },
  {
    title: 'Find error logs from high-volume log streams using a sub-query. ',
    expr: {
      SQL: stripIndents`SELECT 
 \`@logStream\`,
 COUNT(*) as error_count
 FROM \`LogGroupA\`
 WHERE 
 \`start\` >= date_sub(current_timestamp(), 1)
 AND lower(\`@message\`) LIKE '%error%'
 AND \`@logStream\` IN (
 SELECT \`@logStream\`
 FROM \`logs\`
 GROUP BY \`@logStream\`
 HAVING COUNT(*) > 1000
 )
 GROUP BY \`@logStream\`
 ORDER BY error_count DESC`,
    },
  },
  {
    title: 'Extract parameter values from a JSON log group',
    expr: {
      SQL: stripIndents`SELECT query_name, get_json_object(\`@message\`, '$.answers[*].Rdata')
  AS answers FROM \`LogGroupA\` Where query_type = 'A'`,
    },
  },
  {
    title: 'Find the intersection of elements for two columns based on eventName.',
    expr: {
      SQL: stripIndents`SELECT array_intersect(
 array(get_json_object(\`column1\`, '$.eventName')),
 array(get_json_object(\`column2\`, '$.eventName'))
 ) as matching_events
 FROM \`LogGroupA\`;`,
    },
  },
  {
    title: 'Return the top 25 most recently added log events.',
    expr: {
      SQL: 'SELECT `@timestamp`, `@message` FROM `LogGroupA` ORDER BY `@timestamp` DESC LIMIT 25;',
    },
  },
  {
    title: 'Find the number of exceptions logged every five minutes.',
    expr: {
      SQL: `SELECT window.start, COUNT(*) AS exceptionCount FROM \`LogGroupA\` WHERE \`@message\` LIKE '%Exception%' GROUP BY window(\`@timestamp\`, '5 minute') ORDER BY exceptionCount DESC`,
    },
  },
  {
    title: 'Return a list of log events that are not exceptions.',
    expr: {
      SQL: `SELECT \`@message\` FROM \`LogGroupA\` WHERE \`@message\` NOT LIKE '%Exception%'`,
    },
  },
  {
    title: 'Identify faults on API calls.',
    expr: {
      SQL: 'Select @timestamp, @logStream as instanceId, ExceptionMessage from `LogGroupA` where Operation = "x" and Fault > 0',
    },
  },
  {
    title:
      'Return the number of exceptions logged every five minutes using regex where exception is not case sensitive.',
    expr: {
      SQL: `SELECT window.start, COUNT(*) AS exceptionCount FROM \`LogGroupA\` WHERE \`@message\` LIKE '%Exception%' GROUP BY window(\`@timestamp\`, '5 minute') ORDER BY exceptionCount DESC`,
    },
  },
  {
    title:
      'Count the number of logs per minute over the last 24 hours, grouping them into one-minute time buckets and sorting from newest to oldest, and only consider those groups that have error_count greater than zero.',
    expr: {
      SQL: stripIndents`SELECT 
 date(\`@timestamp\`) as log_date,
 \`@logStream\`,
 COUNT(*) as total_messages,
 SUM(CASE WHEN lower(\`@message\`) LIKE '%error%' THEN 1 ELSE 0 END) as error_count,
 SUM(CASE WHEN lower(\`@message\`) LIKE '%warn%' THEN 1 ELSE 0 END) as warning_count
 FROM \`LogGroupA\`
 WHERE \`@timestamp\` >= date_sub(current_timestamp(), 7)
 GROUP BY date(\`startTime\`), \`@logStream\`
 HAVING error_count > 0
 ORDER BY error_count DESC`,
    },
  },
  {
    title:
      'Calculate the total count of logs and unique streams, along with the earliest and latest timestamps for all logs from the past 24 hours.',
    expr: {
      SQL: stripIndents`SELECT 
 COUNT(*) as total_logs,
 COUNT(DISTINCT \`@logStream\`) as unique_streams,
 MIN(\`@timestamp\`) as earliest_log,
 MAX(\`startTime\`) as latest_log
 FROM \`LogGroupA\`
 WHERE \`startTime\` >= date_sub(current_timestamp(), 1)`,
    },
  },
  {
    title:
      "Show the top 10 most active log streams from the past 24 hours, displaying each stream's total log count and its first and last log timestamps, sorted by highest log count first.",
    expr: {
      SQL: stripIndents`SELECT \`@logStream\`, COUNT(*) as log_count, MIN(\`@timestamp\`) as first_seen, MAX(\`@timestamp\`) as last_seen FROM \`LogGroupA\`WHERE \`startTime\` >= date_sub(current_timestamp(), 24)GROUP BY \`@logStream\`ORDER BY log_count DESC LIMIT 10`,
    },
  },
  {
    title: 'Count the number of error messages per hour over the last 24 hours, sorted chronologically by hour.',
    expr: {
      SQL: stripIndents`SELECT 
 hour(\`@timestamp\`) as hour_of_day,
 COUNT(*) as error_count
 FROM \`LogGroupA\`
 WHERE lower(\`@message\`) LIKE '%error%'
 AND \`@timestamp\` >= date_sub(current_timestamp(), 24)
 GROUP BY hour(\`@timestamp\`)
 ORDER BY hour_of_day`,
    },
  },
  {
    title:
      'Categorize and count all log messages from the last 24 hours into different log levels (ERROR, WARNING, INFO, OTHER), based on message content.',
    expr: {
      SQL: stripIndents`SELECT 
 CASE 
 WHEN lower(\`@message\`) LIKE '%error%' THEN 'ERROR'
 WHEN lower(\`@message\`) LIKE '%warn%' THEN 'WARNING'
 WHEN lower(\`@message\`) LIKE '%info%' THEN 'INFO'
 ELSE 'OTHER'
 END as log_level,
 COUNT(*) as message_count
 FROM \`LogGroupA\`
 WHERE \`startTime\` >= date_sub(current_timestamp(), 1)
 GROUP BY CASE 
 WHEN lower(\`@message\`) LIKE '%error%' THEN 'ERROR'
 WHEN lower(\`@message\`) LIKE '%warn%' THEN 'WARNING'
 WHEN lower(\`@message\`) LIKE '%info%' THEN 'INFO'
 ELSE 'OTHER'
 END
 ORDER BY message_count DESC`,
    },
  },
  {
    title:
      'Count the number of logs per minute over the last 24 hours, and group them into one-minute time buckets and sort from newest to oldest.',
    expr: {
      SQL: stripIndents`SELECT 
 date_trunc('minute', startTime) as time_bucket,
 COUNT(*) as log_count
 FROM \`LogGroupA\`
 WHERE startTime >= date_sub(current_timestamp(), 1)
 GROUP BY date_trunc('minute', \`startTime\`)
 ORDER BY time_bucket DESC`,
    },
  },
  {
    title:
      'Find log messages that were truncated, based on analysis of the length of the @message field in the log events.',
    expr: {
      SQL: stripIndents`SELECT 
 length(\`@message\`) as msg_length,
 COUNT(*) as count,
 MIN(\`@message\`) as sample_message
 FROM \`LogGroupA\`
 WHERE \`startTime\` >= date_sub(current_timestamp(), 1)
 GROUP BY length(\`@message\`)
 HAVING count > 10
 ORDER BY msg_length DESC
 LIMIT 10`,
    },
  },
  {
    title:
      'Show the top 10 most common message lengths from the last 24 hours. It displays the length, count, and a sample message for each message length that appears more than 10 times, sorted by longest messages first.',
    expr: {
      SQL: 'SELECT `@logStream`, MAX(`startTime`) as last_log_time, UNIX_TIMESTAMP() - UNIX_TIMESTAMP(MAX(`startTime`)) as seconds_since_last_log FROM `LogGroupA`GROUP BY `@logStream`HAVING seconds_since_last_log > 3600 ORDER BY seconds_since_last_log DESC',
    },
  },
  {
    title:
      'Find duplicate log messages that occurred more than 10 times in the last 24 hours, showing their count, first and last occurrence times, and number of streams they appeared in, sorted by most frequent messages first',
    expr: {
      SQL: stripIndents`SELECT 
 \`@message\`,
 COUNT(*) as occurrence_count,
 MIN(\`@timestamp\`) as first_seen,
 MAX(\`@timestamp\`) as last_seen,
 COUNT(DISTINCT \`@logStream\`) as stream_count
 FROM \`LogGroupA\`
 WHERE \`@timestamp\` >= date_sub(current_timestamp(), 1)
 GROUP BY \`@message\`
 HAVING occurrence_count > 10
 ORDER BY occurrence_count DESC"`,
    },
  },
  {
    title:
      'Count unique message patterns per hour over the last 24 hours. When doing this, it considers only the first 50 characters of longer messages. Results are sorted from most recent hour to oldest.',
    expr: {
      SQL: stripIndents`SSELECT 
 date_trunc('hour', startTime) as hour_window,
 COUNT(DISTINCT 
 CASE 
 WHEN length(\`@message\`) < 50 THEN substr(\`@message\`, 1, length(\`@message\`))
 ELSE substr(\`@message\`, 1, 50)
 END
 ) as unique_patterns
 FROM \`LogGroupA\`
 WHERE startTime >= date_sub(current_timestamp(), 24)
 GROUP BY date_trunc('hour', startTime)
 ORDER BY hour_window DESC"`,
    },
  },
  {
    title:
      'Calculate the success and failure rates of requests, based on occurrence of success or failure keywords in the log.',
    expr: {
      SQL: stripIndents`SELECT 
 date_trunc('minute', \`@timestamp\`) as minute,
 COUNT(*) as total_requests,
 SUM(CASE WHEN lower(\`@message\`) LIKE '%success%' THEN 1 ELSE 0 END) as successful_requests,
 SUM(CASE WHEN lower(\`@message\`) LIKE '%fail%' OR lower(\`@message\`) LIKE '%error%' THEN 1 ELSE 0 END) as failed_requests,
 ROUND(SUM(CASE WHEN lower(\`@message\`) LIKE '%success%' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
 FROM \`LogGroupA\`
 WHERE startTime >= date_sub(current_timestamp(), 1)
 GROUP BY date_trunc('minute', startTime)
 ORDER BY minute DESC"`,
    },
  },
  {
    title: 'Identify and extract specific patterns from messages.',
    expr: {
      SQL: stripIndents`SELECT 
 \`@logStream\`,
 regexp_extract(\`@message\`, '([A-Z0-9]{8})', 1) as id_pattern,
 substring_index(\`@message\`, ' ', 2) as first_two_words,
 left(\`@message\`, 10) as message_start,
 right(\`@message\`, 10) as message_end,
 length(trim(\`@message\`)) - length(replace(lower(\`@message\`), ' ', '')) + 1 as word_count
 FROM \`LogGroupA\`
 WHERE startTime >= date_sub(current_timestamp(), 1)"`,
    },
  },
  {
    title: 'Mask numbers in the log events, replacing them with asterisks.',
    expr: {
      SQL: stripIndents`SELECT 
 \`@logStream\`,
 translate(\`@message\`, '{}[]()',' ') as cleaned_message,
 regexp_replace(\`@message\`, '[0-9]', '*') as numbers_masked,
 concat_ws(' - ', \`@logStream\`, substr(\`@message\`, 1, 50)) as combined_log,
 repeat('*', length(\`@message\`)) as message_mask
 FROM \`LogGroupA\`
 WHERE startTime >= date_sub(current_timestamp(), 1)"`,
    },
  },
  {
    title: 'Find log streams that have more than 50 error logs in the last 24 hours',
    expr: {
      SQL: stripIndents`SELECT 
 \`@logStream\`,
 COUNT(*) as total_logs,
 COUNT(CASE WHEN lower(\`@message\`) LIKE '%error%' THEN 1 END) as error_count
 FROM \`LogGroupA\`
 WHERE \`@timestamp\` >= date_sub(current_timestamp(), 1)
 GROUP BY \`@logStream\`
 HAVING error_count > 50
 ORDER BY error_count DESC"`,
    },
  },
];

const pplOnlyGeneralQueries: SampleQuery[] = [
  {
    title:
      'Calculate the total message length over five-minute intervals, and then find the average value across the five-minute intervals.	',
    expr: {
      PPL: 'eval len_message = length(`@message`) | stats count(len_message) as log_bytes by span(`@timestamp`, 5m) | stats avg(log_bytes) | head 10',
    },
  },
  {
    title: 'Return the top 25 most recently added log events.	',
    expr: {
      PPL: 'fields `@timestamp`, `@message` | sort - `@timestamp` | head 25',
    },
  },
  {
    title: 'Return a list of log events that are not exceptions.	',
    expr: {
      PPL: "eval result = LIKE(`@message`, '%Exception%') | where result = false",
    },
  },
  {
    title: 'Identify faults on API calls.	',
    expr: {
      PPL: stripIndents`"where Operation = <operation> AND Fault > 0
 | fields \`@timestamp\`, \`@logStream\` as instanceId, ExceptionMessage"`,
    },
  },
  {
    title:
      'Return the number of exceptions logged every five minutes using regex where exception is not case sensitive.	',
    expr: {
      PPL: 'eval result = LIKE(`@message`, \'%Exception%\') | where result = true | stats count() as exceptionCount by span(`@timestamp`, "5m") | sort -exceptionCount',
    },
  },
  {
    title: 'Parse the data and counts the number of fields.	',
    expr: {
      PPL: stripIndents`"eval result = LIKE(\`@message\`, 'EndTime') | eval result = true |
 parse \`@message\` '.+=(?<day>[A-Za-z]{3}), \d+' | stats count() by day | head 25"`,
    },
  },
  {
    title:
      'Examine message length patterns per log stream to identify potential truncation issues or abnormal logging behavior that might indicate problems.	',
    expr: {
      PPL: stripIndents`eval msg_length = length(\`@message\`)| stats avg(msg_length) as avg_length, max(msg_length) as max_length, min(msg_length) as min_length by \`@logStream\`| sort - avg_length`,
    },
  },
  {
    title: 'Analyze log volume trends over time to identify patterns and potential issues in system behavior.	',
    expr: {
      PPL: stripIndents`"eval date = ADDDATE(CURRENT_DATE(), -1) | eval result = TIMESTAMP(date) | where \`@timestamp\` > result | 
 stats count() as log_count by span(\`@timestamp\`, 1h) 
 | sort - log_count
 | head 10"`,
    },
  },
  {
    title: 'Group and count error messages to identify the most frequent issues affecting the system.	',
    expr: {
      PPL: stripIndents`eval result = LIKE(\`@message\`, "%Error%") | where result = true | stats count() by \`@logStream\` | head 10`,
    },
  },
  {
    title: 'Find the top causes of error logs.	',
    expr: {
      PPL: stripIndents`eval result = LIKE(\`@message\`, "%Error%") | where result = true | top 2 \`@logStream\` | head 10`,
    },
  },
  {
    title: 'Find the log streams that contribute the least error log events.	',
    expr: {
      PPL: stripIndents`eval result = LIKE(\`@message\`, "%Error%") | where result = true | rare \`@logStream\` | head 10`,
    },
  },
  {
    title:
      'Calculate the total message length over five-minute intervals, and then find the average value across the five-minute intervals.	',
    expr: {
      PPL: stripIndents`eval len_message = length(\`@message\`) | stats count(len_message) as log_bytes by span(\`@timestamp\`, 5m) | stats avg(log_bytes) | head 10`,
    },
  },
  {
    title: 'Find the log events that are not exceptions.	',
    expr: {
      PPL: stripIndents`eval isException = LIKE(\`@message\`, '%exception%') | where isException = false | fields \`@logStream\`, \`@message\` | head 10`,
    },
  },
  {
    title: 'Return the top 25 log events sorted by timestamp.	',
    expr: {
      PPL: stripIndents`fields \`@logStream\`, \`@message\` | sort -\`@timestamp\` | head 25`,
    },
  },
  {
    title: 'Find and display the error count.	',
    expr: {
      PPL: stripIndents`where Operation = "x" and Fault > 0 | fields \`@timestamp\`, \`@logStream\`, ExceptionMessage | head 20`,
    },
  },
];

export const generalQueries: SampleQuery[] = [
  {
    title: 'Find the 25 most recently added log events',
    expr: {
      CWLI: 'fields @timestamp, @message | sort @timestamp desc | limit 25',
      SQL: stripIndents`SELECT \`@timestamp\`, \`@message\`
      FROM \`log_group\`
      ORDER BY \`@timestamp\` DESC
      LIMIT 25`,
      PPL: stripIndents`fields \`@timestamp\`, \`@message\`
| sort - \`@timestamp\`
| head 25
`,
    },
  },
  {
    title: 'Get a list of the number of exceptions per hour',
    expr: {
      CWLI: stripIndents`filter @message like /Exception/
| stats count(*) as exceptionCount by bin(1h)
| sort exceptionCount desc`,
      SQL: stripIndents`SELECT window.start, COUNT(*) AS exceptionCount
FROM \`log_group\`
WHERE \`@message\` LIKE '%Exception%'
GROUP BY window(\`@timestamp\`, '1 hour')
ORDER BY exceptionCount DESC`,
      PPL: stripIndents`where abs(\`@message\`, "%Exception%")
| stats count() as exceptionCount by span(\`@timestamp\`, 1h)
| sort - exceptionCount`,
    },
  },
  {
    title: "Get a list of log events that aren't exceptions.",
    expr: {
      CWLI: 'fields @message | filter @message not like /Exception/',
      SQL: stripIndents`SELECT \`@message\`
FROM \`log_group\`
WHERE \`@message\` NOT LIKE '%Exception%'`,
      PPL: stripIndents`fields \`@message\`
| where not like(\`@message\`, "%Exception%")`,
    },
  },
  {
    title: 'Get the most recent log event for each unique value of the server field',
    expr: {
      CWLI: stripIndents`fields @timestamp, server, severity, message
| sort @timestamp asc
| dedup server`,
      PPL: stripIndents`fields \`@timestamp\`, server, severity, message
| sort \`@timestamp\`
| dedup server`,
    },
  },
  {
    title: 'Get the most recent log event for each unique value of the server field for each severity type',
    expr: {
      CWLI: stripIndents`fields @timestamp, server, severity, message
| sort @timestamp desc
| dedup server, severity`,
      PPL: stripIndents`fields \`@timestamp\`, server, severity, message
| sort - \`@timestamp\`
| dedup server`,
    },
  },
  {
    title: 'Number of exceptions logged every 5 minutes',
    expr: {
      CWLI: 'filter @message like /Exception/ | stats count(*) as exceptionCount by bin(5m) | sort exceptionCount desc',
      SQL: stripIndents`SELECT window.start, COUNT(*) AS exceptionCount
FROM \`log_group\`
WHERE \`@message\` LIKE '%Exception%'
GROUP BY window(\`@timestamp\`, '5 minute')
ORDER BY exceptionCount DESC`,
      PPL: stripIndents`where like(\`@message\`, "%Exception%")
| stats count() as exceptionCount by span(\`@timestamp\`, 5m)
| sort - exceptionCount`,
    },
  },
  ...sqlOnlyGeneralQueries,
  ...pplOnlyGeneralQueries,
];

export const lambdaSamples: SampleQuery[] = [
  {
    title: 'View latency statistics for 5-minute intervals',
    expr: {
      CWLI: stripIndents`filter @type = "REPORT" |
                           stats avg(@duration), max(@duration), min(@duration) by bin(5m)`,
      SQL: stripIndents`SELECT window.start, AVG(\`@duration\`) AS averageDuration,
                            MAX(\`@duration\`) AS maxDuration,
                            MIN(\`@duration\`) AS minDuration
                            FROM \`log_group\`
                            WHERE \`@type\` = 'REPORT'
                            GROUP BY window(\`@timestamp\`, '5 minute')`,
    },
  },
  {
    title: 'Determine the amount of overprovisioned memory',
    expr: {
      CWLI: stripIndents`filter @type = "REPORT"
          | stats max(@memorySize / 1000 / 1000) as provisionedMemoryMB,
            min(@maxMemoryUsed / 1000 / 1000) as smallestMemoryRequestMB,
            avg(@maxMemoryUsed / 1000 / 1000) as avgMemoryUsedMB,
            max(@maxMemoryUsed / 1000 / 1000) as maxMemoryUsedMB,
            provisionedMemoryMB - maxMemoryUsedMB as overProvisionedMB
        `,
      SQL: stripIndents`SELECT MAX(\`@memorySize\` / 1000 / 1000) AS provisonedMemoryMB,
          MIN(\`@maxMemoryUsed\` / 1000 / 1000) AS smallestMemoryRequestMB,
          AVG(\`@maxMemoryUsed\` / 1000 / 1000) AS avgMemoryUsedMB,
          MAX(\`@maxMemoryUsed\` / 1000 / 1000) AS maxMemoryUsedMB,
          MAX(\`@memorySize\` / 1000 / 1000) - MAX(\`@maxMemoryUsed\` / 1000 / 1000) AS overProvisionedMB
          FROM \`log_group\`
          WHERE \`@type\` = 'REPORT'`,
    },
  },
  {
    title: 'Find the most expensive requests',
    expr: {
      CWLI: stripIndents`filter @type = "REPORT"
        | fields @requestId, @billedDuration
        | sort by @billedDuration desc`,
      SQL: stripIndents`SELECT\`@requestId\`, \`@billedDuration\`
              FROM \`log_group\`
              WHERE \`@type\` = 'REPORT'
              ORDER BY \`@billedDuration\` DESC`,
      PPL: stripIndents`where \`@type\` = 'REPORT'
            | fields \`@requestId\`, \`@billedDuration\`
            | sort - \`@billedDuration\``,
    },
  },
];

export const vpcSamples: SampleQuery[] = [
  {
    title: 'Find the top 15 packet transfers across hosts',
    expr: {
      CWLI: stripIndents`stats sum(packets) as packetsTransferred by srcAddr, dstAddr
          | sort packetsTransferred  desc
          | limit 15`,
      SQL: stripIndents`SELECT \`srcAddr\`, \`dstAddr\`, SUM(\`packets\`) AS packetsTransferred
                FROM \`log_group\`
                GROUP BY \`srcAddr\`, \`dstAddr\`
                ORDER BY packetsTransferred DESC
                LIMIT 15;`,
    },
  },

  {
    title: 'Find the IP addresses that use UDP as a data transfer protocol',
    expr: {
      CWLI: 'filter protocol=17 | stats count(*) by srcAddr',
      SQL: stripIndents`SELECT \`srcAddr\`, COUNT(*) AS totalCount
                FROM \`log_group\`
                WHERE \`protocol\` = 17
                GROUP BY srcAddr;`,
    },
  },
  {
    title: 'Find the IP addresses where flow records were skipped during the capture window',
    expr: {
      CWLI: stripIndents`filter logStatus="SKIPDATA"
                | stats count(*) by bin(1h) as t
                | sort t`,
      SQL: stripIndents`SELECT window.start, COUNT(*) AS totalCount
              FROM \`log_group\`
              WHERE \`logStatus\` = 'SKIPDATA'
              GROUP BY window(\`@timestamp\`, '1 minute')
              ORDER BY window.start`,
      PPL: stripIndents`where logStatus="SKIPDATA"
              | stats count() by span(\`@timestamp\`, 1h) as t
              | sort t`,
    },
  },
  {
    title: 'Average, min, and max byte transfers by source and destination IP addresses',
    expr: {
      CWLI: 'stats sum(bytes) as bytesTransferred by srcAddr, dstAddr | sort bytesTransferred desc | limit 10',
      SQL: stripIndents`SELECT \`srcAddr\`, \`dstAddr\`, AVG(\`bytes\`),
    MIN(\`bytes\`), MAX(\`bytes\`)
    FROM \`log_group\`
    GROUP BY \`srcAddr\`, \`dstAddr\``,
    },
  },

  {
    title: 'Top 10 byte transfers by source and destination IP addresses',
    expr: {
      CWLI: 'stats sum(bytes) as bytesTransferred by srcAddr, dstAddr | sort bytesTransferred desc | limit 10',
      SQL: stripIndents`SELECT \`srcAddr\`, \`dstAddr\`, SUM(\`bytes\`) as bytesTransferred
    FROM \`log_group\`
    GROUP BY \`srcAddr\`, \`dstAddr\`
    ORDER BY bytesTransferred DESC
    LIMIT 10`,
    },
  },
  {
    title: 'Top 20 source IP addresses with highest number of rejected requests',
    expr: {
      CWLI: 'filter action="REJECT" | stats count(*) as numRejections by srcAddr | sort numRejections desc | limit 20',
      SQL: stripIndents`SELECT \`srcAddr\`, COUNT(*) AS numRejections
              FROM \`log_group\`
              WHERE \`action\` = 'REJECT'
              GROUP BY \`srcAddr\`
              ORDER BY numRejections DESC
              LIMIT 20`,
    },
  },
  {
    title: 'Find the 10 DNS resolvers with the highest number of requests.',
    expr: {
      CWLI: stripIndents`stats count(*) as numRequests by resolverIp
            | sort numRequests desc
            | limit 10`,
      SQL: stripIndents`SELECT \`resolverIp\`, COUNT(*) AS numRequests
                FROM \`log_group\`
                GROUP BY \`resolverIp\`
                ORDER BY numRequests DESC
                LIMIT 10`,
    },
  },
  {
    title: 'Find the number of records by domain and subdomain where the server failed to complete the DNS request.',
    expr: {
      CWLI: stripIndents`filter responseCode="SERVFAIL" | stats count(*) by queryName`,
      SQL: stripIndents`SELECT \`queryName\`, COUNT(*)
    FROM \`log_group\`
    WHERE \`responseCode\` = 'SERVFAIL'
    GROUP BY \`queryName\``,
      PPL: stripIndents`where \`responseCode\` = 'SERVFAIL'
    | stats count() by \`queryName\``,
    },
  },
  {
    title: 'Number of requests received every 10 minutes by edge location',
    expr: {
      CWLI: 'stats count(*) by queryType, bin(10m)',
      SQL: stripIndents`SELECT window.start, \`queryType\`,
    COUNT(*) AS totalCount
    FROM \`log_group\`
    GROUP BY window(\`@timestamp\`, '10 minute'), \`queryType\``,
      PPL: 'stats count() by queryType, span(`@timestamp`, 10m)',
    },
  },
];

export const cloudtrailSamples: SampleQuery[] = [
  {
    title: 'Find the number of log entries for each service, event type, and AWS Region',
    expr: {
      CWLI: 'stats count(*) by eventSource, eventName, awsRegion',
      PPL: 'stats count() by `eventSource`, `eventName`, `awsRegion`',
      SQL: stripIndents`SELECT \`eventSource\`, \`eventName\`,
    \`awsRegion\`, COUNT(*)
    FROM \`log_group\`
    GROUP BY \`eventSource\`, \`eventName\`,
    \`awsRegion\``,
    },
  },
  {
    title: 'Find the Amazon EC2 hosts that were started or stopped in a given AWS Region',
    expr: {
      CWLI: 'filter (eventName="StartInstances" or eventName="StopInstances") and awsRegion="us-east-2',
      PPL: stripIndents`where \`eventName\` = 'StartInstances'
    OR \`eventName\` = 'StopInstances'
    AND \`awsRegion\` = 'us-east-2'`,
      SQL: stripIndents`SELECT \`@timestamp\`, \`@message\`
    FROM \`log_group\`
    WHERE \`eventName\` = 'StartInstances'
    OR \`eventName\` = 'StopInstances'
    AND \`awsRegion\` = 'us-east-2'`,
    },
  },
  {
    title: 'Find the AWS Regions, user names, and ARNs of newly created IAM users',
    expr: {
      CWLI: stripIndents`filter eventName="CreateUser"
            | fields awsRegion, requestParameters.userName, responseElements.user.arn`,
      PPL: stripIndents`where \`eventName\` = 'CreateUser'
    | fields \`awsRegion\`, \`requestParameters.userName\`, \`responseElements.user.arn\``,
      SQL: stripIndents`SELECT \`awsRegion\`, \`requestParameters.userName\`,
            \`responseElements.user.arn\`
            FROM \`log_group\`
            WHERE \`eventName\` = 'CreateUser'`,
    },
  },
  {
    title: 'Find the number of records where an exception occurred while invoking the API UpdateTrail',
    expr: {
      CWLI: stripIndents`filter eventName="UpdateTrail" and ispresent(errorCode)
    | stats count(*) by errorCode, errorMessage`,
      PPL: stripIndents`where eventName = "UpdateTrail" and isnotnull(errorCode)
    | stats count() by errorCode, errorMessage`,
      SQL: stripIndents`SELECT \`errorCode\`, \`errorMessage\`, COUNT(*)
    FROM \`log_group\`
    WHERE \`eventName\` = 'UpdateTrail'
    AND \`errorCode\` IS NOT NULL
    GROUP BY \`errorCode\`, \`errorMessage\``,
    },
  },
  {
    title: 'Find log entries where TLS 1.0 or 1.1 was used',
    expr: {
      CWLI: stripIndents`filter tlsDetails.tlsVersion in [ "TLSv1", "TLSv1.1" ]
    | stats count(*) as numOutdatedTlsCalls by userIdentity.accountId, recipientAccountId, eventSource, eventName, awsRegion, tlsDetails.tlsVersion, tlsDetails.cipherSuite, userAgent
    | sort eventSource, eventName, awsRegion, tlsDetails.tlsVersion`,
      PPL: stripIndents`where tlsDetails.tlsVersion in ('TLSv1', 'TLSv1.1')
    | stats count() as numOutdatedTlsCalls by
    \`userIdentity.accountId\`, \`recipientAccountId\`,
    \`eventSource\`, \`eventName\`, \`awsRegion\`
    \`tlsDetails.tlsVersion\`, \`tlsDetails.cipherSuite\`
    \`userAgent\`
    | sort \`eventSource\`, \`eventName\`, \`awsRegion\`, \`tlsDetails.tlsVersion\``,
      SQL: stripIndents`SELECT \`userIdentity.accountId\`, \`recipientAccountId\`, \`eventSource\`,
    \`eventName\`, \`awsRegion\`, \`tlsDetails.tlsVersion\`,
    \`tlsDetails.cipherSuite\`, \`userAgent\`, COUNT(*) AS numOutdatedTlsCalls
    FROM \`log_group\`
    WHERE \`tlsDetails.tlsVersion\` IN ('TLSv1', 'TLSv1.1')
    GROUP BY \`userIdentity.accountId\`, \`recipientAccountId\`, \`eventSource\`,
    \`eventName\`, \`awsRegion\`, \`tlsDetails.tlsVersion\`,
    \`tlsDetails.cipherSuite\`, \`userAgent\`
    ORDER BY \`eventSource\`, \`eventName\`, \`awsRegion\`, \`tlsDetails.tlsVersion\``,
    },
  },
  {
    title: 'Find the number of calls per service that used TLS versions 1.0 or 1.1',
    expr: {
      CWLI: stripIndents`filter tlsDetails.tlsVersion in [ "TLSv1", "TLSv1.1" ]
    | stats count(*) as numOutdatedTlsCalls by eventSource
    | sort numOutdatedTlsCalls desc`,
      PPL: stripIndents`where \`tlsDetails.tlsVersion\` in ('TLSv1', 'TLSv1.1')
    | stats count() as numOutdatedTlsCalls by \`eventSource\`
    | sort - numOutdatedTlsCalls`,
      SQL: stripIndents`SELECT \`eventSource\`, COUNT(*) AS numOutdatedTlsCalls
    FROM \`log_group\`
    WHERE \`tlsDetails.tlsVersion\` IN ('TLSv1', 'TLSv1.1')
    GROUP BY \`eventSource\`
    ORDER BY numOutdatedTlsCalls DESC`,
    },
  },
  {
    title: 'Number of log entries by region and EC2 event type',
    expr: {
      CWLI: 'filter eventSource="ec2.amazonaws.com" | stats count(*) as eventCount by eventName, awsRegion | sort eventCount desc',
      PPL: stripIndents`where \`eventSource\` = 'ec2.amazonaws.com'
    | stats count() as eventCount by \`eventName\`, \`awsRegion\`
    | sort - eventCount
    `,
      SQL: stripIndents`SELECT \`eventName\`, \`awsRegion\`,
    COUNT(*) AS eventCount
    FROM \`log_group\`
    WHERE \`eventSource\` = 'ec2.amazonaws.com'
    GROUP BY \`eventName\`, \`awsRegion\`
    ORDER BY eventCount DESC`,
    },
  },
];
export const natSamples: SampleQuery[] = [
  {
    title: 'Find the instances that are sending the most traffic through your NAT gateway',
    expr: {
      CWLI: stripIndents`filter (dstAddr like 'x.x.x.x' and srcAddr like 'y.y.')
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort bytesTransferred desc
    | limit 10`,
      PPL: stripIndents`where like(dstAddr, "x.x.x.x") and like(srcAddr like "y.y.")
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort - bytesTransferred
    | head 10`,
      SQL: stripIndents`SELECT \`srcAddr\`, \`dstAddr\`,
    SUM(\`bytes\`) AS bytesTransferred
    FROM \`log_group\`
    WHERE \`dstAddr\` LIKE 'x.x.x.x'
    AND \`srcAddr\` LIKE \`y.y.%\`
    GROUP BY \`srcAddr\`, \`dstAddr\`
    ORDER BY bytesTransferred DESC
    LIMIT 10`,
    },
  },
  {
    title: "Determine the traffic that's going to and from the instances in your NAT gateways",
    expr: {
      CWLI: stripIndents`filter (dstAddr like 'x.x.x.x' and srcAddr like 'y.y.') or (srcAddr like 'xxx.xx.xx.xx' and dstAddr like 'y.y.')
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort bytesTransferred desc
    | limit 10`,
      PPL: stripIndents`where (like(dstAddr, "x.x.x.x") and like(srcAddr, "y.y.")) or (like(srcAddr, "xxx.xx.xx.xx") and like(dstAddr, "y.y.")
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort - bytesTransferred
    | limit 10`,
      SQL: stripIndents`SELECT \`srcAddr\`, \`dstAddr\`,
    SUM (\`bytes\`) AS bytesTransferred
    FROM \`log_group\`
    WHERE (\`dstAddr\` LIKE 'x.x.x.x' AND \`srcAddr\` LIKE 'y.y.%')
    OR (\`srcAddr\` LIKE 'xxx.xx.xx.xx' AND \`dstAddr\` LIKE 'y.y.%')
    GROUP BY \`srcAddr\`, \`dstAddr\`
    ORDER BY \`bytesTransferred\` DESC
    LIMIT 10`,
    },
  },
  {
    title:
      'Determine the internet destinations that the instances in your VPC communicate with most often for uploads and downloads - for uploads',
    expr: {
      CWLI: stripIndents`filter (srcAddr like 'x.x.x.x' and dstAddr not like 'y.y.')
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort bytesTransferred desc
    | limit 10`,
      PPL: stripIndents`where like(srcAddr like "y.y.") and not like(dstAddr, "x.x.x.x")
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort - bytesTransferred
    | head 10`,
      SQL: stripIndents`SELECT \`srcAddr\`, \`dstAddr\`,
    SUM(\`bytes\`) AS bytesTransferred
    FROM \`log_group\`
    WHERE \`srcAddr\` LIKE 'x.x.x.x'
    AND \`dstAddr\` NOT LIKE \`y.y.%\`
    GROUP BY \`srcAddr\`, \`dstAddr\`
    ORDER BY bytesTransferred DESC
    LIMIT 10`,
    },
  },
  {
    title:
      'Determine the internet destinations that the instances in your VPC communicate with most often for uploads and downloads - for downloads',
    expr: {
      CWLI: stripIndents`filter (dstAddr like 'x.x.x.x' and srcAddr not like 'y.y.')
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort bytesTransferred desc
    | limit 10`,
      PPL: stripIndents`where like(dstAddr, "x.x.x.x") and not like(srcAddr like "y.y.")
    | stats sum(bytes) as bytesTransferred by srcAddr, dstAddr
    | sort - bytesTransferred
    | head 10`,
      SQL: stripIndents`SELECT \`srcAddr\`, \`dstAddr\`,
    SUM(\`bytes\`) AS bytesTransferred
    FROM \`log_group\`
    WHERE \`dstAddr\` LIKE 'x.x.x.x'
    AND \`srcAddr\` NOT LIKE \`y.y.%\`
    GROUP BY \`srcAddr\`, \`dstAddr\`
    ORDER BY bytesTransferred DESC
    LIMIT 10`,
    },
  },
];

export const appSyncSamples: SampleQuery[] = [
  {
    title: 'Number of unique HTTP status codes',
    expr: {
      CWLI: 'fields ispresent(graphQLAPIId) as isApi | filter isApi | filter logType = "RequestSummary" | stats count() as statusCount by statusCode | sort statusCount desc',
      SQL: stripIndents`SELECT \`graphQLAPIId\`, \`statusCode\`,
    COUNT(*) AS statusCount
    FROM \`log_group\`
    WHERE \`logType\` = 'RequestSummary'
    AND \`graphQLAPIId\` IS NOT NULL
    GROUP BY \`graphQLAPIId\`, \`statusCode\`
    ORDER BY statusCount DESC`,
    },
  },
  {
    title: 'Most frequently invoked resolvers',
    expr: {
      CWLI: 'fields ispresent(resolverArn) as isRes | stats count() as invocationCount by resolverArn | filter isRes | filter logType = "Tracing" | sort invocationCount desc | limit 10',
      PPL: stripIndents`where \`logType\` = 'Tracing'
    | fields \`resolverArn\`, \`duration\`
    | sort - duration
    | head 10`,
      SQL: stripIndents`SELECT \`resolverArn\`, COUNT(*) AS invocationCount
    FROM \`log_group\`
    WHERE \`logType\` = 'Tracing'
    AND \`resolverArn\` IS NOT NULL
    GROUP BY \`resolverArn\`
    ORDER BY invocationCount DESC
    LIMIT 10`,
    },
  },
  {
    title: 'Top 10 resolvers with maximum latency',
    expr: {
      CWLI: 'fields resolverArn, duration | filter logType = "Tracing" | sort duration desc | limit 10',
      PPL: stripIndents`where \`logType\` = 'Tracing'
    | fields \`resolverArn\`, \`duration\`
    | sort - duration
    | head 10`,
      SQL: stripIndents`SELECT \`resolverArn\`, \`duration\`
    FROM \`log_group\`
    WHERE \`logType\` = 'Tracing'
    ORDER BY \`duration\` DESC
    LIMIT 10`,
    },
  },
  {
    title: 'Resolvers with most errors in mapping templates',
    expr: {
      CWLI: 'fields ispresent(resolverArn) as isRes | stats count() as errorCount by resolverArn, logType | filter isRes and (logType = "RequestMapping" or logType = "ResponseMapping") and fieldInError | sort errorCount desc | limit 10',
      SQL: stripIndents`SELECT resolverArn, COUNT(*) AS errorCount
    FROM \`log_group\`
    WHERE ISNOTNULL(resolverArn) AND (logType = "RequestMapping" OR logType = "ResponseMapping") AND fieldInError
    GROUP BY resolverArn
    ORDER BY errorCount DESC
    LIMIT 10`,
    },
  },
  {
    title: 'Field latency statistics',
    expr: {
      CWLI: `stats min(duration), max(duration), avg(duration) as avgDur by concat(parentType, '/', fieldName) as fieldKey | filter logType = "Tracing" | sort avgDur desc | limit 10`,
      SQL: stripIndents`SELECT CONCAT(parentType, "/", fieldName) AS fieldKey, MIN(duration), MAX(duration), AVG(duration) as avgDur
    FROM \`log_group\`
    ORDER BY fieldKey
    WHERE logType="Tracing"
    SORTY BY avgDur DESC
    LIMIT 10`,
    },
  },
  {
    title: 'Resolver latency statistics',
    expr: {
      CWLI: 'fields ispresent(resolverArn) as isRes | filter isRes | filter logType = "Tracing" | stats min(duration), max(duration), avg(duration) as avgDur by resolverArn | sort avgDur desc | limit 10 ',
      SQL: stripIndents`SELECT \`resolverArn\`, MIN(\`duration\`),
    MAX(\`duration\`), AVG(\`duration\`) as avgDur
    FROM \`log_group\`
    WHERE \`resolverArn\` IS NOT NULL
    AND \`logType\` = 'Tracing'
    GROUP BY \`resolverArn\`
    ORDER BY avgDur DESC
    LIMIT 10`,
    },
  },
  {
    title: 'Top 10 requests with maximum latency',
    expr: {
      CWLI: 'fields requestId, latency | filter logType = "RequestSummary" | sort latency desc | limit 10',
      PPL: stripIndents`where \`logType\` = 'RequestSummary'
    | fields \`requestId\`, \`latency\`
    | sort - \`latency\`
    | head 10`,
      SQL: stripIndents`SELECT \`requestId\`, \`latency\`
    FROM \`log_group\`
    WHERE \`logType\` = 'RequestSummary'
    ORDER BY \`latency\` DESC
    LIMIT 10`,
    },
  },
];

export const iotSamples = [
  {
    title: 'Count IoT Events and status including errors',
    expr: {
      CWLI: 'fields @timestamp, @message | stats count(*) by eventType, status',
      SQL: stripIndents`SELECT \`eventType\`, \`status\`, COUNT(*)
    FROM \`log_group\`
    GROUP BY \`eventType\`, \`status\``,
    },
  },
  {
    title: 'Count of Disconnect reasons',
    expr: {
      CWLI: 'filter eventType="Disconnect" | stats count(*) by disconnectReason | sort disconnectReason desc',
      PPL: stripIndents`where \`eventType\` = \`Disconnect\`
    | stats count() by \`disconnectReason\`
    | sort - \`disconnectReason\``,
      SQL: stripIndents`SELECT \`disconnectReason\`, COUNT(*)
    FROM \`log_group\`
    WHERE \`eventType\` = 'Disconnect'
    GROUP BY \`disconnectReason\`
    ORDER BY \`disconnectReason\` DESC`,
    },
  },
  {
    title: 'Top 50 devices with Duplicate ClientId disconnect error',
    expr: {
      CWLI: 'filter eventType="Disconnect" and disconnectReason="DUPLICATE_CLIENTID" | stats count(*) by clientId | sort numPublishIn desc | limit 50',
      SQL: stripIndents`SELECT \`clientId\`, COUNT(*) AS duplicateCount
    FROM \`log_group\`
    WHERE \`eventType\` = 'Disconnect'
    AND \`disconnectReason\` = 'DUPLICATE_CLIENTID'
    GROUP BY \`clientId\`
    ORDER BY duplicateCount DESC
    LIMIT 50`,
    },
  },
  {
    title: 'Top 10 failed connections by ClientId',
    expr: {
      CWLI: 'filter eventType="Connect" and status="Failure" | stats count(*) by clientId | sort numPublishIn desc | limit 10',
      SQL: stripIndents`SELECT \`clientId\`, COUNT(*) AS failedConnectionCount
    FROM \`log_group\`
    WHERE \`eventType\` = 'Connect'
    AND \`status\` = 'Failure'
    GROUP BY \`clientId\`
    ORDER BY failedConnectionCount DESC
    LIMIT 10`,
    },
  },
  {
    title: 'Connectivity activity for a device',
    expr: {
      CWLI: 'fields @timestamp, eventType, reason, clientId | filter clientId like /sampleClientID/ | filter eventType like /Connect|Disconnect/ | sort @timestamp desc | limit 20',
      PPL: stripIndents`fields \`@timestamp\`, eventType, reason, clientId
    | where like(clientId, "%sampleClientID%")
    | where like(eventType, "%Connect%") or like(eventType, "%Disconnect%")
    | sort - \`@timestamp\`
    | head 20`,
      SQL: stripIndents`SELECT \`@timestamp\`, \`eventType\`,
    \`reason\`, \`clientId\`
    FROM \`log_group\`
    WHERE \`clientId\` LIKE '%sampleClientID%'
    AND \`eventType\` LIKE ANY ('%Connect%', '%Disconnect%')
    ORDER BY \`@timestamp\` DESC
    LIMIT 20`,
    },
  },
  {
    title: 'View messages published to a topic',
    expr: {
      CWLI: 'fields @timestamp, @message | sort @timestamp desc | filter ( eventType="Publish-In" ) and topicName like \'your/topic/here\'',
      PPL: stripIndents`fields \`@timestamp\`, \`@message\`
    | where eventType = "Publish-In" and like(topicName, "%your/topic/here%")
    | sort - \`@timestamp\``,
      SQL: stripIndents`SELECT \`@timestamp\`, \`@message\`
    FROM \`log_group\`
    WHERE \`eventType\` = 'Publish-In'
    AND \`topicName\` LIKE '%your/topic/here%'`,
    },
  },
];
