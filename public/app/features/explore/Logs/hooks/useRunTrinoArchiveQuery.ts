import { useRef } from 'react';
import { from, lastValueFrom } from 'rxjs';

import {
  AppEvents,
  DataFrame,
  DataQuery,
  DataSourceInstanceSettings,
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  FieldType,
  LoadingState,
  LogLevel,
  LogRowModel,
  LogsSortOrder,
  TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { useDispatch } from 'app/types/store';

import { changeLoadingStateAction } from '../../state/query';

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
    console.warn('No timestamp field found in archive data');
    return [];
  }

  const logField = frame.fields.find((f) => f.name === 'log' && f.type === FieldType.string);
  if (!logField) {
    console.warn('No log field found in archive data');
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

interface UseRunTrinoArchiveQueryProps {
  trinoDataSource: DataSourceInstanceSettings | null;
  timeRange: TimeRange;
  logsQueries?: DataQuery[];
  exploreId: string;
  onDataReceived?: (data: LogRowModel[] | null) => void;
  sortOrder?: LogsSortOrder;
}

export function useRunTrinoArchiveQuery({
  trinoDataSource,
  timeRange,
  logsQueries,
  exploreId,
  onDataReceived,
  sortOrder,
}: UseRunTrinoArchiveQueryProps) {
  const dispatch = useDispatch();
  const isQueryingRef = useRef(false);

  const runArchiveQuery = async () => {
    const tableName = config.trino?.logsArchiveTable;
    
    if (!tableName || !trinoDataSource) {
      const appEvents = getAppEvents();
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('explore.logs.archive.not-configured', 'Archive query is not configured'),
        ],
      });
      return;
    }

    const appEvents = getAppEvents();
    
    if (isQueryingRef.current) {
      appEvents.publish({
        type: AppEvents.alertWarning.name,
        payload: [
          t('explore.logs.archive.already-running', 'An archive query is already running'),
        ],
      });
      return;
    }

    try {
      isQueryingRef.current = true;
      dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Loading }));
      onDataReceived?.(null);
      const datasource = await getDataSourceSrv().get(trinoDataSource.uid);
      const fromTime = timeRange.from.toISOString().replace('T', ' ').replace('Z', ' UTC');
      const toTime = timeRange.to.toISOString().replace('T', ' ').replace('Z', ' UTC');
      const labelConditions = parseLokiLabels(logsQueries);
      const whereConditions = [
        `timestamp BETWEEN TIMESTAMP '${fromTime}' AND TIMESTAMP '${toTime}'`,
        ...labelConditions
      ];
      
      const whereClause = whereConditions.join('\n              AND ');
      
      const orderDirection = sortOrder === LogsSortOrder.Ascending ? 'ASC' : 'DESC';

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
          ORDER BY timestamp ${orderDirection}
          LIMIT 1000
        `,
        format: 2,
      };

      const request = {
        targets: [query],
        range: timeRange,
        requestId: `archive-log-enrichment-${Date.now()}`,
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
          const logRows = convertDataFrameToLogRows(frame);
          onDataReceived?.(logRows);
          
          appEvents.publish({
            type: AppEvents.alertSuccess.name,
            payload: [
              t('explore.logs.archive.success', 'Successfully loaded {{count}} logs from archive', {
                count: logRows.length,
              }),
            ],
          });
        } else {
          console.warn('No data returned from archive query');
          onDataReceived?.(null);
          
          appEvents.publish({
            type: AppEvents.alertWarning.name,
            payload: [
              t('explore.logs.archive.no-data', 'No logs found in archive for the selected time range'),
            ],
          });
        }
      } else {
        console.warn('No data returned from archive query');
        onDataReceived?.(null);
        
        appEvents.publish({
          type: AppEvents.alertWarning.name,
          payload: [
            t('explore.logs.archive.no-results', 'No results returned from archive query'),
          ],
        });
      }
    } catch (error) {
      console.error('Error querying from archive:', error);
      onDataReceived?.(null);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('explore.logs.archive.error', 'Failed to query archive'),
          errorMessage,
        ],
      });
    } finally {
      isQueryingRef.current = false;
      dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Done }));
    }
  };

  return {
    runArchiveQuery,
    isQuerying: isQueryingRef.current,
  };
}
