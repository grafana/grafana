import { render, waitFor } from '@testing-library/react';
import { removeCanvasTransforms } from 'jest-canvas-mock-compare';
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
import { TableCellDisplayMode } from '@grafana/schema';

import * as measureTextModule from '../../../../utils/measureText';
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

describe('TableNG SparklineCell threshold wiring (canvas)', () => {
  const realPrepareConfig = sparklineUtils.prepareConfig;
  const realGetCanvasContext = measureTextModule.getCanvasContext;
  let prepareConfigSpy: jest.SpyInstance;
  let getCanvasContextSpy: jest.SpyInstance;
  let uPlotInstance: InstanceType<typeof uPlot> | undefined;

  const assertCanvasOutput = async () => {
    await waitFor(() => expect(document.querySelector('.u-over')).toBeInTheDocument());
    expect(removeCanvasTransforms(uPlotInstance!.ctx.__getEvents())).toMatchCanvasSnapshot([], { width, height });
  };

  beforeEach(() => {
    uPlotInstance = undefined;
    // gradientFills.ts creates linear gradients on the shared measureText canvas
    // (getCanvasContext) — separate from uPlot's own ctx — so the createLinearGradient
    // geometry never lands in uPlotInstance.ctx events and the viewer can't replay it.
    // Routing both to the same ctx makes the snapshot self-contained.
    getCanvasContextSpy = jest
      .spyOn(measureTextModule, 'getCanvasContext')
      .mockImplementation(() => uPlotInstance?.ctx ?? realGetCanvasContext());

    prepareConfigSpy = jest.spyOn(sparklineUtils, 'prepareConfig').mockImplementation((...args) => {
      const builder: UPlotConfigBuilder = realPrepareConfig(...args);
      builder.addHook('init', (u: uPlot) => {
        uPlotInstance = u;
      });
      return builder;
    });
  });

  afterEach(() => {
    prepareConfigSpy.mockRestore();
    getCanvasContextSpy.mockRestore();
  });

  it('renders scheme gradient when color mode is Thresholds with steps', async () => {
    renderSparklineCell(
      sparklineField({
        custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
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

  it('renders hue gradient when color mode is Fixed', async () => {
    renderSparklineCell(
      sparklineField({
        custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
        color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [{ value: 0, color: 'green' }],
        },
      })
    );

    await assertCanvasOutput();
  });

  it('renders hue gradient when Thresholds mode has no steps', async () => {
    renderSparklineCell(
      sparklineField({
        custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
        color: { mode: FieldColorModeId.Thresholds },
        thresholds: { mode: ThresholdsMode.Absolute, steps: [] },
      })
    );

    await assertCanvasOutput();
  });
});
