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

import { DEPLOY_INDEX, REQUEST_DURATION } from '../../mockScenario';

const CHART_HEIGHT = 110;
const STEP_MS = 60_000;

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
    <PanelChrome title={t('drilldown-page.evidence.request-duration', 'Request duration by route')}>
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
          {t(
            'drilldown-page.evidence.request-duration-caption',
            'Dashed line: deploy v231 · /pay route drives the increase'
          )}
        </Text>
      </Stack>
    </PanelChrome>
  );
}

function buildPanelData(): PanelData {
  const end = Math.floor(Date.now() / STEP_MS) * STEP_MS;
  const times = REQUEST_DURATION.map((_, index) => end - (REQUEST_DURATION.length - 1 - index) * STEP_MS);
  const from = dateTime(times[0] - STEP_MS / 2);
  const to = dateTime(end + STEP_MS / 2);

  return {
    state: LoadingState.Done,
    timeRange: { from, to, raw: { from, to } },
    series: [
      createDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: times },
          { name: '/pay', type: FieldType.number, values: REQUEST_DURATION },
        ],
      }),
    ],
    annotations: [
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [times[DEPLOY_INDEX] - STEP_MS / 2] },
          { name: 'text', type: FieldType.string, values: ['deploy v231'] },
          { name: 'color', type: FieldType.string, values: ['rgba(204, 204, 220, 0.5)'] },
          { name: 'isRegion', type: FieldType.boolean, values: [false] },
        ],
      }),
    ],
  };
}
