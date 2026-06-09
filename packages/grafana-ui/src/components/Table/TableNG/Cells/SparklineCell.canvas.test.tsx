import { render, waitFor } from '@testing-library/react';
import type uPlot from 'uplot';

import {
  applyFieldOverrides,
  createTheme,
  FieldColorModeId,
  FieldType,
  type Field,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { GraphGradientMode, TableCellDisplayMode } from '@grafana/schema';
import { applyDefaultUPlotAxisMeasureTextMock, removeCanvasTransforms } from '@grafana/test-utils/canvas';

import { measureText as uPlotAxisMeasureText } from '../../../../utils/measureText';
import * as sparklineUtils from '../../../Sparkline/utils';
import { type UPlotConfigBuilder } from '../../../uPlot/config/UPlotConfigBuilder';

import { SparklineCell } from './SparklineCell';

const width = 300;
const height = 25;

const tsFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000] },
    { name: 'v', type: FieldType.number, values: [1, 99] },
  ],
});

function sparklineField(config: Field['config']): Field {
  const raw = toDataFrame({
    fields: [
      {
        name: 'trend',
        type: FieldType.frame,
        values: [tsFrame],
        config,
      },
    ],
  });
  return applyFieldOverrides({
    data: [raw],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (v) => v,
    theme: createTheme(),
    timeZone: 'utc',
  })[0].fields[0];
}

function renderSparklineCell(field: Field) {
  return render(<SparklineCell field={field} rowIdx={0} theme={createTheme()} value={tsFrame} width={width} />);
}

let uPlotInstance: InstanceType<typeof uPlot> | undefined;
jest.mock('../../../../utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() => uPlotInstance)
);

describe('TableNG SparklineCell threshold wiring (canvas)', () => {
  const realPrepareConfig = sparklineUtils.prepareConfig;
  let prepareConfigSpy: jest.SpyInstance;

  const assertCanvasOutput = async () => {
    await waitFor(() => expect(document.querySelector('.u-over')).toBeInTheDocument());
    expect(removeCanvasTransforms(uPlotInstance!.ctx.__getEvents())).toMatchCanvasSnapshot([], { width, height });
  };

  beforeEach(() => {
    applyDefaultUPlotAxisMeasureTextMock(jest.mocked(uPlotAxisMeasureText));

    uPlotInstance = undefined;

    prepareConfigSpy = jest.spyOn(sparklineUtils, 'prepareConfig').mockImplementation((...args) => {
      const builder: UPlotConfigBuilder = realPrepareConfig(...args);
      builder.addHook('drawAxes', (u: uPlot) => {
        u.ctx.__clearEvents();
        uPlotInstance = u;
      });
      return builder;
    });
  });

  afterEach(() => {
    prepareConfigSpy.mockRestore();
  });

  it('renders scheme gradient w/ Thresholds color mode', async () => {
    renderSparklineCell(
      sparklineField({
        custom: { cellOptions: { type: TableCellDisplayMode.Sparkline, gradientMode: GraphGradientMode.Scheme } },
        color: { mode: FieldColorModeId.Thresholds },
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 80, color: 'red' },
          ],
        },
      })
    );

    await assertCanvasOutput();
  });

  it.each(Object.values(GraphGradientMode))('renders %s gradient w/ continuous color mode', async (gradientMode) => {
    renderSparklineCell(
      sparklineField({
        custom: { cellOptions: { type: TableCellDisplayMode.Sparkline, gradientMode } },
        color: { mode: FieldColorModeId.ContinuousViridis },
      })
    );

    await assertCanvasOutput();
  });
});
