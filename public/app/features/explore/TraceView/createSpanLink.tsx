import {
  DataFrame,
  DataLink,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  dateTime,
  Field,
  LinkModel,
  mapInternalLinkToExplore,
  rangeUtil,
  ScopedVars,
  SplitOpen,
  TimeRange,
} from '@grafana/data';
import {
  TraceToProfilesOptions,
  TraceToMetricsOptions,
  TraceToLogsOptionsV2,
  TraceToLogsTag,
} from '@grafana/o11y-ds-frontend';
import { PromQuery } from '@grafana/prometheus';
import { getTemplateSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Icon } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { LokiQuery } from '../../../plugins/datasource/loki/types';
import { ExploreFieldLinkModel, getFieldLinksForExplore, getVariableUsageInfo } from '../utils/links';

import { SpanLinkDef, SpanLinkFunc, Trace, TraceSpan } from './components';
import { SpanLinkType } from './components/types/links';
import { TraceSpanReference } from './components/types/trace';

/**
 * This is a factory for the link creator. It returns the function mainly so it can return undefined in which case
 * the trace view won't create any links and to capture the datasource and split function making it easier to memoize
 * with useMemo.
 */
export function createSpanLinkFactory({
  splitOpenFn,
  traceToLogsOptions,
  traceToMetricsOptions,
  traceToProfilesOptions,
  dataFrame,
  createFocusSpanLink,
  trace,
}: {
  splitOpenFn: SplitOpen;
  traceToLogsOptions?: TraceToLogsOptionsV2;
  traceToMetricsOptions?: TraceToMetricsOptions;
  traceToProfilesOptions?: TraceToProfilesOptions;
  dataFrame?: DataFrame;
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>;
  trace: Trace;
}): SpanLinkFunc | undefined {
  if (!dataFrame) {
    return undefined;
  }

  let scopedVars = scopedVarsFromTrace(trace.duration, trace.traceName, trace.traceID);
  const hasLinks = dataFrame.fields.some((f) => Boolean(f.config.links?.length));

  const createSpanLinks = legacyCreateSpanLinkFactory(
    splitOpenFn,
    // We need this to make the types happy but for this branch of code it does not matter which field we supply.
    dataFrame.fields[0],
    traceToLogsOptions,
    traceToMetricsOptions,
    createFocusSpanLink,
    scopedVars
  );

  return function SpanLink(span: TraceSpan): SpanLinkDef[] | undefined {
    let spanLinks = createSpanLinks(span);

    if (hasLinks) {
      scopedVars = {
        ...scopedVars,
        ...scopedVarsFromSpan(span),
        ...scopedVarsFromTags(span, traceToProfilesOptions),
      };
      // We should be here only if there are some links in the dataframe
      const fields = dataFrame.fields.filter((f) => Boolean(f.config.links?.length))!;
      try {
        let profilesDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
        if (traceToProfilesOptions?.datasourceUid) {
          profilesDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToProfilesOptions.datasourceUid);
        }
        const hasConfiguredPyroscopeDS = profilesDataSourceSettings?.type === 'grafana-pyroscope-datasource';
        const hasPyroscopeProfile = span.tags.some((tag) => tag.key === pyroscopeProfileIdTagKey);
        const shouldCreatePyroscopeLink = hasConfiguredPyroscopeDS && hasPyroscopeProfile;

        let links: ExploreFieldLinkModel[] = [];
        fields.forEach((field) => {
          const fieldLinksForExplore = getFieldLinksForExplore({
            field,
            rowIndex: span.dataFrameRowIndex!,
            splitOpenFn,
            range: getTimeRangeFromSpan(span, undefined, undefined, shouldCreatePyroscopeLink),
            dataFrame,
            vars: scopedVars,
          });
          links = links.concat(fieldLinksForExplore);
        });

        const newSpanLinks: SpanLinkDef[] = links.map((link) => {
          return {
            title: link.title,
            href: link.href,
            onClick: link.onClick,
            content: <Icon name="link" title={link.title || 'Link'} />,
            field: link.origin,
            type: shouldCreatePyroscopeLink ? SpanLinkType.Profiles : SpanLinkType.Unknown,
            target: link.target,
          };
        });

        spanLinks.push.apply(spanLinks, newSpanLinks);
      } catch (error) {
        // It's fairly easy to crash here for example if data source defines wrong interpolation in the data link
        console.error(error);
        return spanLinks;
      }
    }

    return spanLinks;
  };
}

/**
 * Default keys to use when there are no configured tags.
 */
const formatDefaultKeys = (keys: string[]) => {
  return keys.map((k) => ({
    key: k,
    value: k.includes('.') ? k.replace('.', '_') : undefined,
  }));
};
const defaultKeys = formatDefaultKeys(['cluster', 'hostname', 'namespace', 'pod', 'service.name', 'service.namespace']);
export const defaultProfilingKeys = formatDefaultKeys(['service.name', 'service.namespace']);
export const pyroscopeProfileIdTagKey = 'pyroscope.profile.id';
export const feO11yTagKey = 'gf.feo11y.app.id';

function legacyCreateSpanLinkFactory(
  splitOpenFn: SplitOpen,
  field: Field,
  traceToLogsOptions?: TraceToLogsOptionsV2,
  traceToMetricsOptions?: TraceToMetricsOptions,
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>,
  scopedVars?: ScopedVars
) {
  let logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
  if (traceToLogsOptions?.datasourceUid) {
    logsDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToLogsOptions.datasourceUid);
  }
  const isSplunkDS = logsDataSourceSettings?.type === 'grafana-splunk-datasource';

  let metricsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
  if (traceToMetricsOptions?.datasourceUid) {
    metricsDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToMetricsOptions.datasourceUid);
  }

  return function SpanLink(span: TraceSpan): SpanLinkDef[] {
    scopedVars = {
      ...scopedVars,
      ...scopedVarsFromSpan(span),
    };
    const links: SpanLinkDef[] = [];
    let query: DataQuery | undefined;
    let tags = '';

    // TODO: This should eventually move into specific data sources and added to the data frame as we no longer use the
    //  deprecated blob format and we can map the link easily in data frame.
    if (logsDataSourceSettings && traceToLogsOptions) {
      const customQuery = traceToLogsOptions.customQuery ? traceToLogsOptions.query : undefined;
      const tagsToUse =
        traceToLogsOptions.tags && traceToLogsOptions.tags.length > 0 ? traceToLogsOptions.tags : defaultKeys;
      switch (logsDataSourceSettings?.type) {
        case 'loki':
          tags = getFormattedTags(span, tagsToUse);
          query = getQueryForLoki(span, traceToLogsOptions, tags, customQuery);
          break;
        case 'grafana-splunk-datasource':
          tags = getFormattedTags(span, tagsToUse, { joinBy: ' ' });
          query = getQueryForSplunk(span, traceToLogsOptions, tags, customQuery);
          break;
        case 'elasticsearch':
        case 'grafana-opensearch-datasource':
          tags = getFormattedTags(span, tagsToUse, { labelValueSign: ':', joinBy: ' AND ' });
          query = getQueryForElasticsearchOrOpensearch(span, traceToLogsOptions, tags, customQuery);
          break;
        case 'grafana-falconlogscale-datasource':
          tags = getFormattedTags(span, tagsToUse, { joinBy: ' OR ' });
          query = getQueryForFalconLogScale(span, traceToLogsOptions, tags, customQuery);
          break;
        case 'googlecloud-logging-datasource':
          tags = getFormattedTags(span, tagsToUse, { joinBy: ' AND ' });
          query = getQueryForGoogleCloudLogging(span, traceToLogsOptions, tags, customQuery);
      }

      // query can be false in case the simple UI tag mapping is used but none of them are present in the span.
      // For custom query, this is always defined and we check if the interpolation matched all variables later on.
      if (query) {
        const dataLink: DataLink = {
          title: logsDataSourceSettings.name,
          url: '',
          internal: {
            datasourceUid: logsDataSourceSettings.uid,
            datasourceName: logsDataSourceSettings.name,
            query,
          },
        };

        scopedVars = {
          ...scopedVars,
          __tags: {
            text: 'Tags',
            value: tags,
          },
        };

        // Check if all variables are defined and don't show if they aren't. This is usually handled by the
        // getQueryFor* functions but this is for case of custom query supplied by the user.
        if (getVariableUsageInfo(dataLink.internal!.query, scopedVars).allVariablesDefined) {
          const link = mapInternalLinkToExplore({
            link: dataLink,
            internalLink: dataLink.internal!,
            scopedVars: scopedVars,
            range: getTimeRangeFromSpan(
              span,
              {
                startMs: traceToLogsOptions.spanStartTimeShift
                  ? rangeUtil.intervalToMs(traceToLogsOptions.spanStartTimeShift)
                  : 0,
                endMs: traceToLogsOptions.spanEndTimeShift
                  ? rangeUtil.intervalToMs(traceToLogsOptions.spanEndTimeShift)
                  : 0,
              },
              isSplunkDS
            ),
            field: {} as Field,
            onClickFn: splitOpenFn,
            replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
          });

          links.push({
            href: link.href,
            title: 'Related logs',
            onClick: link.onClick,
            content: <Icon name="gf-logs" title="Explore the logs for this in split view" />,
            field,
            type: SpanLinkType.Logs,
          });
        }
      }
    }

    // Get metrics links
    if (metricsDataSourceSettings && traceToMetricsOptions?.queries) {
      for (const query of traceToMetricsOptions.queries) {
        const expr =
          query.query ||
          `histogram_quantile(0.5, sum(rate(traces_spanmetrics_latency_bucket{service="${span.process.serviceName}"}[5m])) by (le))`;
        const dataLink: DataLink<PromQuery> = {
          title: metricsDataSourceSettings.name,
          url: '',
          internal: {
            datasourceUid: metricsDataSourceSettings.uid,
            datasourceName: metricsDataSourceSettings.name,
            query: {
              expr,
              refId: 'A',
            },
          },
        };

        const tagsToUse =
          traceToMetricsOptions.tags && traceToMetricsOptions.tags.length > 0
            ? traceToMetricsOptions.tags
            : defaultKeys;

        scopedVars = {
          ...scopedVars,
          __tags: {
            text: 'Tags',
            value: getFormattedTags(span, tagsToUse),
          },
        };

        const link = mapInternalLinkToExplore({
          link: dataLink,
          internalLink: dataLink.internal!,
          scopedVars,
          range: getTimeRangeFromSpan(span, {
            startMs: traceToMetricsOptions.spanStartTimeShift
              ? rangeUtil.intervalToMs(traceToMetricsOptions.spanStartTimeShift)
              : -120000,
            endMs: traceToMetricsOptions.spanEndTimeShift
              ? rangeUtil.intervalToMs(traceToMetricsOptions.spanEndTimeShift)
              : 120000,
          }),
          field: {} as Field,
          onClickFn: splitOpenFn,
          replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        });

        links.push({
          title: query?.name,
          href: link.href,
          onClick: link.onClick,
          content: <Icon name="chart-line" title="Explore metrics for this span" />,
          field,
          type: SpanLinkType.Metrics,
        });
      }
    }

    // Get trace links
    if (span.references && createFocusSpanLink) {
      for (const reference of span.references) {
        // Ignore parent-child links
        if (reference.refType === 'CHILD_OF') {
          continue;
        }

        const link = createFocusSpanLink(reference.traceID, reference.spanID);
        const title = getReferenceTitle(reference);

        links!.push({
          href: link.href,
          title,
          content: <Icon name="link" title={title} />,
          onClick: link.onClick,
          field: link.origin,
          type: SpanLinkType.Traces,
        });
      }
    }

    if (span.subsidiarilyReferencedBy && createFocusSpanLink) {
      for (const reference of span.subsidiarilyReferencedBy) {
        const link = createFocusSpanLink(reference.traceID, reference.spanID);
        const title = getReferenceTitle(reference);

        links!.push({
          href: link.href,
          title,
          content: <Icon name="link" title={title} />,
          onClick: link.onClick,
          field: link.origin,
          type: SpanLinkType.Traces,
        });
      }
    }

    // Get session links
    const feO11yLink = getLinkForFeO11y(span);
    if (feO11yLink) {
      links.push({
        title: 'Session for this span',
        href: feO11yLink,
        content: <Icon name="frontend-observability" title="Session for this span" />,
        field,
        type: SpanLinkType.Session,
      });
    }

    return links;
  };
}

const getReferenceTitle = (reference: TraceSpanReference) => {
  let title = reference.span ? reference.span.operationName : 'View linked span';
  if (reference.refType === 'EXTERNAL') {
    title = 'View linked span';
  }
  return title;
};

function getQueryForLoki(
  span: TraceSpan,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
): LokiQuery | undefined {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { expr: customQuery, refId: '' };
  }

  if (!tags) {
    return undefined;
  }

  let expr = '{${__tags}}';
  if (filterByTraceID && span.traceID) {
    expr +=
      ' | label_format log_line_contains_trace_id=`{{ contains "${__span.traceId}" __line__  }}` | log_line_contains_trace_id="true" OR trace_id="${__span.traceId}"';
  }
  if (filterBySpanID && span.spanID) {
    expr +=
      ' | label_format log_line_contains_span_id=`{{ contains "${__span.spanId}" __line__  }}` | log_line_contains_span_id="true" OR span_id="${__span.spanId}"';
  }

  return {
    expr: expr,
    refId: '',
  };
}

function getLinkForFeO11y(span: TraceSpan): string | undefined {
  const feO11yAppId = span.process.tags.find((tag) => tag.key === feO11yTagKey)?.value;
  const feO11ySessionId = span.tags.find((tag) => tag.key === 'session_id' || tag.key === 'session.id')?.value;

  return feO11yAppId && feO11ySessionId
    ? `/a/grafana-kowalski-app/apps/${feO11yAppId}/sessions/${feO11ySessionId}`
    : undefined;
}

// we do not have access to the dataquery type for opensearch,
// so here is a minimal interface that handles both elasticsearch and opensearch.
interface ElasticsearchOrOpensearchQuery extends DataQuery {
  query: string;
  metrics: Array<{
    id: string;
    type: 'logs';
  }>;
}

function getQueryForElasticsearchOrOpensearch(
  span: TraceSpan,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
): ElasticsearchOrOpensearchQuery {
  const { filterByTraceID, filterBySpanID } = options;
  if (customQuery) {
    return {
      query: customQuery,
      refId: '',
      metrics: [{ id: '1', type: 'logs' }],
    };
  }

  let queryArr = [];
  if (filterBySpanID && span.spanID) {
    queryArr.push('"${__span.spanId}"');
  }

  if (filterByTraceID && span.traceID) {
    queryArr.push('"${__span.traceId}"');
  }

  if (tags) {
    queryArr.push('${__tags}');
  }

  return {
    query: queryArr.join(' AND '),
    refId: '',
    metrics: [{ id: '1', type: 'logs' }],
  };
}

function getQueryForSplunk(span: TraceSpan, options: TraceToLogsOptionsV2, tags: string, customQuery?: string) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { query: customQuery, refId: '' };
  }

  let query = '';
  if (tags) {
    query += '${__tags}';
  }
  if (filterByTraceID && span.traceID) {
    query += ' "${__span.traceId}"';
  }
  if (filterBySpanID && span.spanID) {
    query += ' "${__span.spanId}"';
  }

  return {
    query: query,
    refId: '',
  };
}

function getQueryForGoogleCloudLogging(
  span: TraceSpan,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { query: customQuery, refId: '' };
  }

  let queryArr = [];
  if (filterBySpanID && span.spanID) {
    queryArr.push('"${__span.spanId}"');
  }

  if (filterByTraceID && span.traceID) {
    queryArr.push('"${__span.traceId}"');
  }

  if (tags) {
    queryArr.push('${__tags}');
  }

  return {
    query: queryArr.join(' AND '),
    refId: '',
  };
}

function getQueryForFalconLogScale(span: TraceSpan, options: TraceToLogsOptionsV2, tags: string, customQuery?: string) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return {
      lsql: customQuery,
      refId: '',
    };
  }

  if (!tags) {
    return undefined;
  }

  let lsql = '${__tags}';
  if (filterByTraceID && span.traceID) {
    lsql += ' or "${__span.traceId}"';
  }

  if (filterBySpanID && span.spanID) {
    lsql += ' or "${__span.spanId}"';
  }

  return {
    lsql,
    refId: '',
  };
}

/**
 * Creates a string representing all the tags already formatted for use in the query. The tags are filtered so that
 * only intersection of tags that exist in a span and tags that you want are serialized into the string.
 */
export function getFormattedTags(
  span: TraceSpan,
  tags: TraceToLogsTag[],
  { labelValueSign = '=', joinBy = ', ' }: { labelValueSign?: string; joinBy?: string } = {}
) {
  // In order, try to use mapped tags -> tags -> default tags
  // Build tag portion of query
  return [
    ...span.process.tags,
    ...span.tags,
    { key: 'spanId', value: span.spanID },
    { key: 'traceId', value: span.traceID },
    { key: 'name', value: span.operationName },
    { key: 'duration', value: span.duration },
  ]
    .map((tag) => {
      const keyValue = tags.find((keyValue) => keyValue.key === tag.key);
      if (keyValue) {
        return `${keyValue.value ? keyValue.value : keyValue.key}${labelValueSign}"${tag.value}"`;
      }
      return undefined;
    })
    .filter((v) => Boolean(v))
    .join(joinBy);
}

/**
 * Gets a time range from the span.
 */
function getTimeRangeFromSpan(
  span: TraceSpan,
  timeShift: { startMs: number; endMs: number } = { startMs: 0, endMs: 0 },
  isSplunkDS = false,
  shouldCreatePyroscopeLink = false
): TimeRange {
  let adjustedStartTime = Math.floor(span.startTime / 1000 + timeShift.startMs);
  const spanEndMs = (span.startTime + span.duration) / 1000;
  let adjustedEndTime = Math.floor(spanEndMs + timeShift.endMs);

  // Splunk requires a time interval of >= 1s, rather than >=1ms like Loki timerange in below elseif block
  if (isSplunkDS && adjustedEndTime - adjustedStartTime < 1000) {
    adjustedEndTime = adjustedStartTime + 1000;
  } else if (shouldCreatePyroscopeLink) {
    adjustedStartTime = adjustedStartTime - 60000;
    adjustedEndTime = adjustedEndTime + 60000;
  } else if (adjustedStartTime === adjustedEndTime) {
    // Because we can only pass milliseconds in the url we need to check if they equal.
    // We need end time to be later than start time
    adjustedEndTime++;
  }

  const to = dateTime(adjustedEndTime);
  const from = dateTime(adjustedStartTime);

  // Beware that public/app/features/explore/state/main.ts SplitOpen fn uses the range from here. No matter what is in the url.
  return {
    from,
    to,
    raw: {
      from,
      to,
    },
  };
}

/**
 * Variables from trace that can be used in the query
 * @param trace
 */
export function scopedVarsFromTrace(duration: number, name: string, traceId: string): ScopedVars {
  return {
    __trace: {
      text: 'Trace',
      value: {
        duration,
        name,
        traceId,
      },
    },
  };
}

/**
 * Variables from span that can be used in the query
 * @param span
 */
export function scopedVarsFromSpan(span: TraceSpan): ScopedVars {
  const tags: ScopedVars = {};

  // We put all these tags together similar way we do for the __tags variable. This means there can be some overriding
  // of values if there is the same tag in both process tags and span tags.
  for (const tag of span.process.tags) {
    tags[tag.key] = tag.value;
  }
  for (const tag of span.tags) {
    tags[tag.key] = tag.value;
  }

  return {
    __span: {
      text: 'Span',
      value: {
        spanId: span.spanID,
        traceId: span.traceID,
        duration: span.duration,
        name: span.operationName,
        tags: tags,
      },
    },
  };
}

/**
 * Variables from tags that can be used in the query
 * @param span
 */
export function scopedVarsFromTags(
  span: TraceSpan,
  traceToProfilesOptions: TraceToProfilesOptions | undefined
): ScopedVars {
  let tags: ScopedVars = {};

  if (traceToProfilesOptions) {
    const profileTags =
      traceToProfilesOptions.tags && traceToProfilesOptions.tags.length > 0
        ? traceToProfilesOptions.tags
        : defaultProfilingKeys;

    tags = {
      __tags: {
        text: 'Tags',
        value: getFormattedTags(span, profileTags),
      },
    };
  }

  return tags;
}
