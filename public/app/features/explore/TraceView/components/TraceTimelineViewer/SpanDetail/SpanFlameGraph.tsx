import { css } from '@emotion/css';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMeasure } from 'react-use';
import { lastValueFrom } from 'rxjs';

import {
  CoreApp,
  type DataFrame,
  type DataQueryRequest,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  dateTime,
  type TimeZone,
} from '@grafana/data';
import { FlameGraph } from '@grafana/flamegraph';
import { Trans } from '@grafana/i18n';
import { type TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import {
  DataSourceWithBackend,
  getTemplateSrv,
  getDataSourceInstance,
  useDataSourceInstanceSettings,
} from '@grafana/runtime';
import { Collapse, Spinner, useStyles2, useTheme2 } from '@grafana/ui';
import { type PyroscopeQuery } from 'app/features/explore/TraceView/components/TraceTimelineViewer/SpanDetail/pyroscope-types';

import { SpanProfileRevealContext, useSpanProfiles } from '../../../SpanProfiles';
import {
  defaultProfilingKeys,
  pyroscopeProfileIdTagKey,
  scopedVarsFromSpan,
  scopedVarsFromTags,
} from '../../../createSpanLink';
import { scopedVarsFromTrace } from '../../../createTraceLink';
import { getFormattedTags, getSpanTags } from '../../../crossSignalConfig';
import { type TraceSpan } from '../../types/trace';

import { type TraceFlameGraphs } from '.';

export type SpanFlameGraphProps = {
  span: TraceSpan;
  traceToProfilesOptions?: TraceToProfilesOptions;
  timeZone: TimeZone;
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  setRedrawListView: (redraw: {}) => void;
  traceDuration: number;
  traceName: string;
};

export default function SpanFlameGraph(props: SpanFlameGraphProps) {
  const {
    span,
    traceToProfilesOptions: configuredOptions,
    timeZone,
    traceFlameGraphs,
    setTraceFlameGraphs,
    setRedrawListView,
    traceDuration,
    traceName,
  } = props;
  const profiles = useSpanProfiles();
  const match =
    profiles[span.spanID]?.find((match) => match.profileTypeId === configuredOptions?.profileTypeId) ??
    profiles[span.spanID]?.find((match) => match.profileTypeId.includes(':cpu:nanoseconds:')) ??
    profiles[span.spanID]?.[0];
  const traceToProfilesOptions = useMemo(
    () =>
      match
        ? {
            datasourceUid: match.datasourceUid,
            profileTypeId: match.profileTypeId,
            customQuery: true,
            query: match.labelSelector,
          }
        : configuredOptions,
    [match, configuredOptions]
  );
  const [isOpen, setIsOpen] = useState(true);
  const { spanId: revealedSpanId, reveal } = useContext(SpanProfileRevealContext);
  const graphRef = useRef<HTMLDivElement>(null);
  const [queryError, setQueryError] = useState(false);
  const [sizeRef, { height: containerHeight }] = useMeasure<HTMLDivElement>();
  const styles = useStyles2(getStyles);
  const profilesUid = traceToProfilesOptions?.datasourceUid;
  const { settings: loadedProfilesSettings } = useDataSourceInstanceSettings(profilesUid);
  // Undefined ref resolves to the default DS — only use settings when a profiles UID is configured.
  const profilesDataSourceSettings = profilesUid ? loadedProfilesSettings : undefined;
  const theme = useTheme2();

  const profileTag = span.tags.filter((tag) => tag.key === pyroscopeProfileIdTagKey);
  const profileTagValue = match ? span.spanID : profileTag.length > 0 ? profileTag[0].value : undefined;
  const cacheKey = match
    ? `${match.datasourceUid}/${match.labelSelector}/${span.spanID}/${match.profileTypeId}`
    : profileTagValue;

  useEffect(() => {
    if (revealedSpanId !== span.spanID) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      setIsOpen(true);
      graphRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      reveal('');
    });
    return () => cancelAnimationFrame(frame);
  }, [revealedSpanId, span.spanID, reveal]);

  const getTimeRangeForProfile = useCallback(() => {
    const spanStartMs = Math.floor(span.startTime / 1000) - 30000;
    const spanEndMs = (span.startTime + span.duration) / 1000 + 30000;
    const to = dateTime(spanEndMs);
    const from = dateTime(spanStartMs);

    return {
      from,
      to,
      raw: {
        from,
        to,
      },
    };
  }, [span.duration, span.startTime]);

  const getFlameGraphData = async (request: DataQueryRequest<PyroscopeQuery>, datasourceUid: string) => {
    const ds = await getDataSourceInstance(datasourceUid);
    if (ds instanceof DataSourceWithBackend) {
      const result = await lastValueFrom(ds.query(request));
      const frame = result.data.find((x: DataFrame) => {
        return x.name === 'response';
      });
      if (frame && frame.length > 1) {
        return frame;
      }
    }
  };

  const queryFlameGraph = useCallback(
    async (
      profilesDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>,
      traceToProfilesOptions: TraceToProfilesOptions,
      span: TraceSpan
    ) => {
      let labelSelector = '{}';
      if (match) {
        labelSelector = match.labelSelector;
      } else if (traceToProfilesOptions.customQuery && traceToProfilesOptions.query) {
        const scopedVars = {
          ...scopedVarsFromTrace(traceDuration, traceName, span.traceID),
          ...scopedVarsFromSpan(span),
          ...scopedVarsFromTags(span, traceToProfilesOptions),
        };
        labelSelector = getTemplateSrv().replace(traceToProfilesOptions.query, scopedVars);
      } else {
        const tags =
          traceToProfilesOptions.tags && traceToProfilesOptions.tags.length > 0
            ? traceToProfilesOptions.tags
            : defaultProfilingKeys;
        labelSelector = `{${getFormattedTags(getSpanTags(span), tags)}}`;
      }

      const request = {
        requestId: 'span-flamegraph-requestId',
        interval: '2s',
        intervalMs: 2000,
        range: getTimeRangeForProfile(),
        scopedVars: {},
        app: CoreApp.Unknown,
        timezone: timeZone,
        startTime: span.startTime,
        targets: [
          {
            labelSelector,
            groupBy: [],
            profileTypeId: traceToProfilesOptions.profileTypeId ?? '',
            queryType: 'profile' as const,
            spanSelector: [profileTagValue],
            refId: 'span-flamegraph-refId',
            datasource: {
              type: profilesDataSourceSettings.type,
              uid: profilesDataSourceSettings.uid,
            },
            includeExemplars: false,
            heatmapType: 'individual' as const,
            includeHeatmap: false,
          },
        ],
      };
      const flameGraph = await getFlameGraphData(request, profilesDataSourceSettings.uid);

      if (flameGraph && flameGraph.length > 0) {
        setTraceFlameGraphs({ ...traceFlameGraphs, [cacheKey]: flameGraph });
      }
    },
    [
      getTimeRangeForProfile,
      profileTagValue,
      cacheKey,
      match,
      setTraceFlameGraphs,
      timeZone,
      traceDuration,
      traceFlameGraphs,
      traceName,
    ]
  );

  useEffect(() => {
    if (!Object.keys(traceFlameGraphs).includes(cacheKey)) {
      if (traceToProfilesOptions && profilesDataSourceSettings) {
        void queryFlameGraph(profilesDataSourceSettings, traceToProfilesOptions, span).catch(() => setQueryError(true));
      }
    }
  }, [
    setTraceFlameGraphs,
    span,
    traceFlameGraphs,
    traceToProfilesOptions,
    profilesDataSourceSettings,
    getTimeRangeForProfile,
    timeZone,
    queryFlameGraph,
    profileTagValue,
    cacheKey,
  ]);

  useEffect(() => {
    setRedrawListView({});
  }, [containerHeight, setRedrawListView]);

  return (
    <div className={styles.flameGraph} ref={graphRef}>
      <div ref={sizeRef}>
        <Collapse
          label={<Trans i18nKey="explore.span-flame-graph.flame-graph">Flame graph</Trans>}
          isOpen={isOpen}
          onToggle={() => setIsOpen((open) => !open)}
        >
          {queryError ? (
            <Trans i18nKey="explore.span-flame-graph.failed">Unable to load the span flame graph.</Trans>
          ) : traceFlameGraphs[cacheKey] ? (
            <FlameGraph
              data={traceFlameGraphs[cacheKey]}
              getTheme={() => theme}
              initialViewMode="single"
              disableCollapsing={true}
            />
          ) : (
            <div className={styles.loading} role="status">
              <Spinner /> <Trans i18nKey="explore.span-flame-graph.loading">Loading span profile…</Trans>
            </div>
          )}
        </Collapse>
      </div>
    </div>
  );
}

const getStyles = () => {
  return {
    loading: css({
      minHeight: 150,
      padding: '16px',
    }),
    flameGraph: css({
      label: 'flameGraphInSpan',
      width: '100%',
      marginTop: '5px',
    }),
  };
};
