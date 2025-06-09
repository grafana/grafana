import { css } from '@emotion/css';
import { useCallback, useEffect } from 'react';
import { useMeasure } from 'react-use';
import { lastValueFrom } from 'rxjs';

import {
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  dateTime,
  TimeZone,
} from '@grafana/data';
import { FlameGraph } from '@grafana/flamegraph';
import { Trans } from '@grafana/i18n';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { Query } from 'app/plugins/datasource/grafana-pyroscope-datasource/types';

import {
  defaultProfilingKeys,
  getFormattedTags,
  pyroscopeProfileIdTagKey,
  scopedVarsFromSpan,
  scopedVarsFromTags,
  scopedVarsFromTrace,
} from '../../../createSpanLink';
import { TraceSpan } from '../../types/trace';

import { TraceFlameGraphs } from '.';

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
    traceToProfilesOptions,
    timeZone,
    traceFlameGraphs,
    setTraceFlameGraphs,
    setRedrawListView,
    traceDuration,
    traceName,
  } = props;
  const [sizeRef, { height: containerHeight }] = useMeasure<HTMLDivElement>();
  const styles = useStyles2(getStyles);

  const profileTag = span.tags.filter((tag) => tag.key === pyroscopeProfileIdTagKey);
  const profileTagValue = profileTag.length > 0 ? profileTag[0].value : undefined;

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

  const getFlameGraphData = async (request: DataQueryRequest<Query>, datasourceUid: string) => {
    const ds = await getDatasourceSrv().get(datasourceUid);
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
      if (traceToProfilesOptions.customQuery && traceToProfilesOptions.query) {
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
        labelSelector = `{${getFormattedTags(span, tags)}}`;
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
          },
        ],
      };
      const flameGraph = await getFlameGraphData(request, profilesDataSourceSettings.uid);

      if (flameGraph && flameGraph.length > 0) {
        setTraceFlameGraphs({ ...traceFlameGraphs, [profileTagValue]: flameGraph });
      }
    },
    [getTimeRangeForProfile, profileTagValue, setTraceFlameGraphs, timeZone, traceDuration, traceFlameGraphs, traceName]
  );

  useEffect(() => {
    if (!Object.keys(traceFlameGraphs).includes(profileTagValue)) {
      let profilesDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
      if (traceToProfilesOptions && traceToProfilesOptions?.datasourceUid) {
        profilesDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToProfilesOptions.datasourceUid);
      }
      if (traceToProfilesOptions && profilesDataSourceSettings) {
        queryFlameGraph(profilesDataSourceSettings, traceToProfilesOptions, span);
      }
    }
  }, [
    setTraceFlameGraphs,
    span,
    traceFlameGraphs,
    traceToProfilesOptions,
    getTimeRangeForProfile,
    timeZone,
    queryFlameGraph,
    profileTagValue,
  ]);

  useEffect(() => {
    setRedrawListView({});
  }, [containerHeight, setRedrawListView]);

  if (!traceFlameGraphs[profileTagValue]) {
    return <></>;
  }

  return (
    <div className={styles.flameGraph} ref={sizeRef}>
      <div className={styles.flameGraphTitle}>
        <Trans i18nKey="explore.span-flame-graph.flame-graph">Flame graph</Trans>
      </div>
      <FlameGraph
        data={traceFlameGraphs[profileTagValue]}
        getTheme={() => config.theme2}
        showFlameGraphOnly={true}
        disableCollapsing={true}
      />
    </div>
  );
}

const getStyles = () => {
  return {
    flameGraph: css({
      label: 'flameGraphInSpan',
      margin: '5px',
    }),
    flameGraphTitle: css({
      label: 'flameGraphTitleInSpan',
      marginBottom: '5px',
      fontWeight: 'bold',
    }),
  };
};
