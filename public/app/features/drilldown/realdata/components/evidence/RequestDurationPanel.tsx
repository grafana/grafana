import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import {
  FieldType,
  LoadingState,
  type PanelData,
  createDataFrame,
  dateTime,
  type FieldConfigSource,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelRenderer } from '@grafana/runtime';
import { AxisPlacement, BarAlignment, GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode } from '@grafana/schema';
import { PanelChrome, Stack, Text } from '@grafana/ui';

import {
  DEPLOY_INDEX,
  DEPLOY_LABEL,
  EVIDENCE_TEXT,
  REQUEST_DURATION,
  REQUEST_ROUTE,
  REQUEST_STEP_MS,
} from '../../liveScenario';

const CHART_HEIGHT = 110;

const fieldConfig: FieldConfigSource = {
  defaults: {
    unit: 's',
    color: { mode: 'fixed', fixedColor: 'blue' },
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      barAlignment: BarAlignment.Center,
      barWidthFactor: 0.6,
      fillOpacity: 100,
      lineWidth: 0,
      axisPlacement: AxisPlacement.Hidden,
    },
  },
  overrides: [],
};

const options = {
  legend: { showLegend: false, displayMode: LegendDisplayMode.Hidden, placement: 'bottom', calcs: [] },
  tooltip: { mode: TooltipDisplayMode.Single },
};

export function RequestDurationPanel() {
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  const data = useMemo(buildPanelData, []);

  return (
    <PanelChrome title={t('drilldown-real.evidence.request-duration', 'Request duration by route')}>
      <Stack direction="column" gap={1}>
        <div ref={measureRef} style={{ height: CHART_HEIGHT }}>
          {width > 0 && (
            <PanelRenderer
              title=""
              pluginId="timeseries"
              width={width}
              height={CHART_HEIGHT}
              data={data}
              options={options}
              fieldConfig={fieldConfig}
            />
          )}
        </div>
        <Text variant="bodySmall" color="secondary">
          {EVIDENCE_TEXT.requestCaption}
        </Text>
      </Stack>
    </PanelChrome>
  );
}

function buildPanelData(): PanelData {
  const stepMs = REQUEST_STEP_MS;
  const end = Math.floor(Date.now() / stepMs) * stepMs;
  const times = REQUEST_DURATION.map((_, index) => end - (REQUEST_DURATION.length - 1 - index) * stepMs);
  const from = dateTime((times[0] ?? end) - stepMs / 2);
  const to = dateTime(end + stepMs / 2);

  return {
    state: LoadingState.Done,
    timeRange: { from, to, raw: { from, to } },
    series: [
      createDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: times },
          { name: REQUEST_ROUTE || 'p95', type: FieldType.number, values: REQUEST_DURATION },
        ],
      }),
    ],
    annotations:
      DEPLOY_INDEX >= 0 && times[DEPLOY_INDEX] !== undefined
        ? [
            createDataFrame({
              fields: [
                { name: 'time', type: FieldType.time, values: [times[DEPLOY_INDEX] - stepMs / 2] },
                { name: 'text', type: FieldType.string, values: [DEPLOY_LABEL] },
                { name: 'color', type: FieldType.string, values: ['rgba(204, 204, 220, 0.5)'] },
                { name: 'isRegion', type: FieldType.boolean, values: [false] },
              ],
            }),
          ]
        : [],
  };
}
