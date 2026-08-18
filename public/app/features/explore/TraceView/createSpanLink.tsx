import {
  type DataFrame,
  type DataLink,
  type DataLinkPostProcessor,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  type Field,
  FieldType,
  type LinkModel,
  mapInternalLinkToExplore,
  rangeUtil,
  type ScopedVars,
  type SplitOpen,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type TraceToProfilesOptions,
  type TraceToMetricsOptions,
  type TraceToLogsOptionsV2,
} from '@grafana/o11y-ds-frontend';
import { type PromQuery } from '@grafana/prometheus';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon } from '@grafana/ui';

import { type ExploreFieldLinkModel, getFieldLinksForExplore, getVariableUsageInfo } from '../utils/links';

import { getTraceToLogsSpanQuery, interpolateQueries } from './components/logsLink';
import { type SpanLinkDef, type SpanLinkFunc, SpanLinkType } from './components/types/links';
import { type Trace, type TraceSpan, type TraceSpanReference } from './components/types/trace';
import { getTimeRangeFromTimestamps, scopedVarsFromTrace } from './createTraceLink';
import { getDefaultMetricTags, getDefaultProfilingTags, getFormattedTags, getSpanTags } from './crossSignalConfig';

/**
 * This is a factory for the link creator. It returns the function mainly so it can return undefined in which case
 * the trace view won't create any links and to capture the datasource and split function making it easier to memoize
 * with useMemo.
 *
 * Linked datasource settings must be resolved by the caller (e.g. via {@link useDataSourceInstanceSettings})
 * because the datasource APIs are async.
 */
export function createSpanLinkFactory({
  splitOpenFn,
  traceToLogsOptions,
  traceToMetricsOptions,
  traceToProfilesOptions,
  dataFrame,
  createFocusSpanLink,
  trace,
  dataLinkPostProcessor,
  logsDataSourceSettings,
  metricsDataSourceSettings,
  profilesDataSourceSettings,
}: {
  splitOpenFn: SplitOpen;
  traceToLogsOptions?: TraceToLogsOptionsV2;
  traceToMetricsOptions?: TraceToMetricsOptions;
  traceToProfilesOptions?: TraceToProfilesOptions;
  dataFrame?: DataFrame;
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>;
  trace: Trace;
  dataLinkPostProcessor?: DataLinkPostProcessor;
  logsDataSourceSettings?: DataSourceInstanceSettings<DataSourceJsonData>;
  metricsDataSourceSettings?: DataSourceInstanceSettings<DataSourceJsonData>;
  profilesDataSourceSettings?: DataSourceInstanceSettings<DataSourceJsonData>;
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
    scopedVars,
    dataFrame,
    dataLinkPostProcessor,
    logsDataSourceSettings,
    metricsDataSourceSettings
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

export const defaultProfilingKeys = getDefaultProfilingTags();
export const pyroscopeProfileIdTagKey = 'pyroscope.profile.id';
const feO11yTagKey = 'gf.feo11y.app.id';

function legacyCreateSpanLinkFactory(
  splitOpenFn: SplitOpen,
  field: Field,
  traceToLogsOptions?: TraceToLogsOptionsV2,
  traceToMetricsOptions?: TraceToMetricsOptions,
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>,
  scopedVars?: ScopedVars,
  dataFrame?: DataFrame,
  dataLinkPostProcessor?: DataLinkPostProcessor,
  logsDataSourceSettings?: DataSourceInstanceSettings<DataSourceJsonData>,
  metricsDataSourceSettings?: DataSourceInstanceSettings<DataSourceJsonData>
) {
  return function SpanLink(span: TraceSpan): SpanLinkDef[] {
    scopedVars = {
      ...scopedVars,
      ...scopedVarsFromSpan(span),
    };
    const links: SpanLinkDef[] = [];

    // TODO: This should eventually move into specific data sources and added to the data frame as we no longer use the
    //  deprecated blob format and we can map the link easily in data frame.
    if (logsDataSourceSettings && traceToLogsOptions) {
      const { query, tags } = getTraceToLogsSpanQuery(span, logsDataSourceSettings, traceToLogsOptions);

      // query can be false in case the simple UI tag mapping is used but none of them are present in the span.
      // For custom query, this is always defined and we check if the interpolation matched all variables later on.
      if (query) {
        const isSplunkDS = logsDataSourceSettings?.type === 'grafana-splunk-datasource';
        const dataLink: DataLink = {
          title: logsDataSourceSettings.name,
          url: '',
          internal: {
            datasourceUid: logsDataSourceSettings.uid,
            datasourceName: logsDataSourceSettings.name,
            // If multiple queries are returned, use the first query to respect the interface.
            // LogsLink will then try to figure out which query to use and uppdate the link.
            // Otherwise, non-array, will use the legacy behavior.
            query: Array.isArray(query) ? query[0] : query,
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
          },
        };

        scopedVars = {
          ...scopedVars,
          __tags: {
            text: t('explore.legacy-create-span-link-factory.text.tags', 'Tags'),
            value: tags,
          },
        };

        const replaceVariables = getTemplateSrv().replace.bind(getTemplateSrv());

        // Check if all variables are defined and don't show if they aren't. This is usually handled by the
        // getQueryFor* functions but this is for case of custom query supplied by the user.
        if (getVariableUsageInfo(dataLink.internal!.query, scopedVars).allVariablesDefined) {
          let link = mapInternalLinkToExplore({
            link: dataLink,
            internalLink: dataLink.internal!,
            scopedVars: scopedVars,
            range: dataLink.internal!.range,
            field: {
              name: '',
              type: FieldType.other,
              config: {},
              values: [],
            },
            onClickFn: splitOpenFn,
            replaceVariables,
          });

          link =
            (dataFrame &&
              dataLinkPostProcessor?.({
                frame: dataFrame,
                field: field,
                dataLinkScopedVars: scopedVars,
                replaceVariables,
                config: {},
                link: dataLink,
                linkModel: link,
              })) ||
            link;

          if (Array.isArray(query)) {
            link.interpolatedParams = {
              ...link.interpolatedParams,
              alternativeQueries: interpolateQueries(query, scopedVars, replaceVariables).map((query) => ({
                ...query,
                datasource: { uid: logsDataSourceSettings.uid },
              })),
            };
          }

          links.push({
            href: link.href,
            linkModel: link,
            title: t('explore.legacy-create-span-link-factory.title.related-logs', 'Related logs'),
            onClick: link.onClick,
            content: (
              <Icon
                name="gf-logs"
                title={t(
                  'explore.legacy-create-span-link-factory.title-explore-split',
                  'Explore the logs for this in split view'
                )}
              />
            ),
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
            : getDefaultMetricTags();

        scopedVars = {
          ...scopedVars,
          __tags: {
            text: t('explore.legacy-create-span-link-factory.text.tags', 'Tags'),
            value: getFormattedTags(getSpanTags(span), tagsToUse),
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
          field: {
            name: '',
            type: FieldType.other,
            config: {},
            values: [],
          },
          onClickFn: splitOpenFn,
          replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        });

        links.push({
          title: query?.name,
          href: link.href,
          onClick: link.onClick,
          content: (
            <Icon
              name="chart-line"
              title={t(
                'explore.legacy-create-span-link-factory.title-explore-metrics-for-this-span',
                'Explore metrics for this span'
              )}
            />
          ),
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
          linkModel: link,
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
        title: t('explore.legacy-create-span-link-factory.title.session-for-this-span', 'Session for this span'),
        href: feO11yLink,
        content: (
          <Icon
            name="frontend-observability"
            title={t('explore.legacy-create-span-link-factory.title-session-for-this-span', 'Session for this span')}
          />
        ),
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

function getLinkForFeO11y(span: TraceSpan): string | undefined {
  const feO11yAppId = span.process.tags.find((tag) => tag.key === feO11yTagKey)?.value;
  const feO11ySessionId = span.tags.find((tag) => tag.key === 'session_id' || tag.key === 'session.id')?.value;

  return feO11yAppId && feO11ySessionId
    ? `/a/grafana-kowalski-app/apps/${feO11yAppId}/sessions/${feO11ySessionId}`
    : undefined;
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
  return getTimeRangeFromTimestamps(span.startTime, span.duration, timeShift, isSplunkDS, shouldCreatePyroscopeLink);
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
      text: t('explore.scoped-vars-from-span.text.span', 'Span'),
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
        text: t('explore.scoped-vars-from-tags.text.tags', 'Tags'),
        value: getFormattedTags(getSpanTags(span), profileTags),
      },
    };
  }

  return tags;
}
