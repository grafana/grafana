import { useEffect, useMemo } from 'react';
import { from, lastValueFrom } from 'rxjs';

import {
  AppEvents,
  DataFrame,
  DataQuery,
  DataSourceInstanceSettings,
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  FieldType,
  LogLevel,
  LogRowModel,
  TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { LogLineMenuCustomItem } from 'app/features/logs/components/panel/LogLineMenu';
import { LogListModel } from 'app/features/logs/components/panel/processing';
import { checkLogsSampled } from 'app/features/logs/utils';

interface UseTrinoLogMenuItemsProps {
  datasourceType?: string;
  trinoDataSource: DataSourceInstanceSettings | null;
  timeRange: TimeRange;
  onEnrichedDataReceived?: (data: LogRowModel[] | null) => void;
  logRows?: LogRowModel[];
  logsQueries?: DataQuery[];
}

interface LokiQuery extends DataQuery {
  expr?: string;
}

function isLokiQuery(query: DataQuery): query is LokiQuery {
  return 'expr' in query;
}

function parseLokiLabels(queries?: DataQuery[]): string[] {
  if (!queries || queries.length === 0) {
    return [];
  }

  const conditions: string[] = [];
  const query = queries[0];
  if (!isLokiQuery(query)) {
    return [];
  }
  
  const expr = query.expr;
  if (!expr) {
    return [];
  }

  // parses label: label="value" or label=~"regex"
  const labelMatch = expr.match(/\{([^}]+)\}/);
  if (!labelMatch) {
    return [];
  }
  const labelSelectors = labelMatch[1];
  const matchers = labelSelectors.match(/(\w+)\s*(=~?|!=~?)\s*"([^"]*)"/g);
  
  if (matchers) {
    for (const matcher of matchers) {
      const match = matcher.match(/(\w+)\s*(=~?|!=~?)\s*"([^"]*)"/);
      if (match) {
        const [, label, operator, value] = match;
        
        // loki operator to sql condition
        if (operator === '=') {
          // equal
          conditions.push(`element_at(resource_attributes, '${label}') = '${value}'`);
        } else if (operator === '!=') {
          // not equal
          conditions.push(`element_at(resource_attributes, '${label}') != '${value}'`);
        } else if (operator === '=~') {
          // regex
          conditions.push(`regexp_like(element_at(resource_attributes, '${label}'), '${value}')`);
        } else if (operator === '!=~') {
          // negative regex
          conditions.push(`NOT regexp_like(element_at(resource_attributes, '${label}'), '${value}')`);
        }
      }
    }
  }

  const lineFilters = expr.match(/(\|=|\|~|!=|!~)\s*"([^"]*)"/g);
  if (lineFilters) {
    for (const filter of lineFilters) {
      const match = filter.match(/(\|=|\|~|!=|!~)\s*"([^"]*)"/);
      if (match) {
        const [, operator, value] = match;
        
        if (operator === '|=') {
          conditions.push(`log LIKE '%${value}%'`);
        } else if (operator === '!=') {
          conditions.push(`log NOT LIKE '%${value}%'`);
        } else if (operator === '|~') {
          conditions.push(`regexp_like(log, '${value}')`);
        } else if (operator === '!~') {
          conditions.push(`NOT regexp_like(log, '${value}')`);
        }
      }
    }
  }

  return conditions;
}

function extractLogLevel(logContent: string): LogLevel {
  const levelMatch = logContent.match(/level=(\w+)/i);
  if (levelMatch) {
    const level = levelMatch[1].toLowerCase();
    switch (level) {
      case 'trace':
        return LogLevel.trace;
      case 'debug':
        return LogLevel.debug;
      case 'info':
        return LogLevel.info;
      case 'warn':
      case 'warning':
        return LogLevel.warning;
      case 'error':
        return LogLevel.error;
      case 'critical':
      case 'fatal':
        return LogLevel.critical;
      default:
        return LogLevel.unknown;
    }
  }
  return LogLevel.unknown;
}

function extractTimestampFromLog(logContent: string): number {
  const timestampMatch = logContent.match(/timestamp=([^\s]+)/);
  if (timestampMatch) {
    const timestamp = new Date(timestampMatch[1]).getTime();
    if (!isNaN(timestamp)) {
      return timestamp;
    }
  }
  return Date.now();
}

function parseLogfmt(logContent: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  const regex = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  let match;
  
  while ((match = regex.exec(logContent)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3];
    fields[key] = value;
  }
  
  return fields;
}

function convertDataFrameToLogRows(frame: DataFrame): LogRowModel[] {
  const rows: LogRowModel[] = [];

  const timeField = frame.fields.find((f) => f.type === FieldType.time);
  if (!timeField) {
    console.warn('No timestamp field found in Trino data');
    return [];
  }

  const logField = frame.fields.find((f) => f.name === 'log' && f.type === FieldType.string);
  if (!logField) {
    console.warn('No log field found in Trino data');
    return [];
  }

  for (let i = 0; i < frame.length; i++) {
    const rawLogContent = logField.values[i] || '';
    const parsedFields = parseLogfmt(rawLogContent);

    let timeEpochMs = timeField.values[i];
    if (!timeEpochMs || timeEpochMs === 0) {
      timeEpochMs = extractTimestampFromLog(rawLogContent);
    }
    
    const timeEpochNs = `${timeEpochMs}000000`;

    const row: LogRowModel = {
      entryFieldIndex: 0,
      rowIndex: i,
      dataFrame: frame,
      logLevel: extractLogLevel(rawLogContent),
      timeFromNow: dateTimeFormatTimeAgo(timeEpochMs),
      timeEpochMs,
      timeEpochNs,
      timeLocal: dateTimeFormat(timeEpochMs, { timeZone: 'browser' }),
      timeUtc: dateTimeFormat(timeEpochMs, { timeZone: 'utc' }),
      uniqueLabels: undefined,
      hasAnsi: false,
      hasUnescapedContent: false,
      searchWords: [],
      entry: rawLogContent,
      raw: rawLogContent,
      labels: { source: 'trino', ...parsedFields },
      uid: `trino_${i}`,
      datasourceType: 'trino',
    };

    rows.push(row);
  }

  return rows;
}

// creates trino query menu item for logs lines if we are querying loki and trino is available
export function useTrinoLogMenuItems({
  datasourceType,
  trinoDataSource,
  timeRange,
  onEnrichedDataReceived,
  logRows,
  logsQueries,
}: UseTrinoLogMenuItemsProps): LogLineMenuCustomItem[] {
  useEffect(() => {
    onEnrichedDataReceived?.(null);
  }, [logRows, onEnrichedDataReceived]);
  
  return useMemo(() => {
    const tableName = config.trino?.logsArchiveTable;
    
    if (!tableName || datasourceType !== 'loki' || !trinoDataSource) {
      return [];
    }

    const trinoMenuItem: LogLineMenuCustomItem = {
      label: t('explore.logs.trino.enrich', 'Query All Logs from Trino'),
      // only shows if the log has the adaptive logs sampled warning
      shouldShow: (log: LogListModel) => {
        return !!checkLogsSampled(log);
      },
      onClick: async (log: LogListModel) => {
        const appEvents = getAppEvents();
        
        try {
          onEnrichedDataReceived?.(null);
          const datasource = await getDataSourceSrv().get(trinoDataSource.uid);
          const fromTime = timeRange.from.toISOString().replace('T', ' ').replace('Z', ' UTC');
          const toTime = timeRange.to.toISOString().replace('T', ' ').replace('Z', ' UTC');
          const labelConditions = parseLokiLabels(logsQueries);
          const whereConditions = [
            `timestamp BETWEEN TIMESTAMP '${fromTime}' AND TIMESTAMP '${toTime}'`,
            ...labelConditions
          ];
          
          const whereClause = whereConditions.join('\n              AND ');

          const query = {
            refId: 'A',
            datasource: {
              type: trinoDataSource.type,
              uid: trinoDataSource.uid,
            },
            rawSQL: `
              SELECT
                timestamp, log
              FROM
                ${tableName}
              WHERE ${whereClause}
              LIMIT 1000
            `,
            format: 2,
          };

          const request = {
            targets: [query],
            range: timeRange,
            requestId: `trino-log-enrichment-${Date.now()}`,
            interval: '1s',
            intervalMs: 1000,
            scopedVars: {},
            timezone: 'browser',
            app: 'explore' as const,
            startTime: Date.now(),
          };

          const queryResult = datasource.query(request);
          const observable = queryResult instanceof Promise ? from(queryResult) : queryResult;
          const result = await lastValueFrom(observable);

          if (result?.data && result.data.length > 0) {
            const frame = result.data[0];
            if (frame.length > 0) {
              console.log('Enriched log data from Trino', frame);
              const logRows = convertDataFrameToLogRows(frame);
              onEnrichedDataReceived?.(logRows);
              
              appEvents.publish({
                type: AppEvents.alertSuccess.name,
                payload: [
                  t('explore.logs.trino.success', 'Successfully loaded {{count}} logs from Trino', {
                    count: logRows.length,
                  }),
                ],
              });
            } else {
              console.warn('No enriched data found in Trino for this log');
              onEnrichedDataReceived?.(null);
              
              appEvents.publish({
                type: AppEvents.alertWarning.name,
                payload: [
                  t('explore.logs.trino.no-data', 'No logs found in Trino for the selected time range'),
                ],
              });
            }
          } else {
            console.warn('No data returned from Trino query');
            onEnrichedDataReceived?.(null);
            
            appEvents.publish({
              type: AppEvents.alertWarning.name,
              payload: [
                t('explore.logs.trino.no-results', 'No results returned from Trino query'),
              ],
            });
          }
        } catch (error) {
          console.error('Error querying Trino:', error);
          onEnrichedDataReceived?.(null);
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          appEvents.publish({
            type: AppEvents.alertError.name,
            payload: [
              t('explore.logs.trino.error', 'Failed to query Trino'),
              errorMessage,
            ],
          });
        }
      },
    };

    return [
      { divider: true },
      trinoMenuItem,
    ];
  }, [datasourceType, trinoDataSource, timeRange, onEnrichedDataReceived, logsQueries]);
}

