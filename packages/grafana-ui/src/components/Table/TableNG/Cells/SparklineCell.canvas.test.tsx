import { render, waitFor } from '@testing-library/react';
import type uPlot from 'uplot';

import {
  type AbsoluteTimeRange,
  ActionType,
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
import { TableNG } from '../TableNG';

import { SparklineCell } from './SparklineCell';

const width = 300;
const height = 25;

const getTsFrame = () =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: 'v', type: FieldType.number, values: [1, 99] },
    ],
  });

function sparklineField(config: Field['config'], type: FieldType = FieldType.frame): Field {
  const tsFrame = getTsFrame();
  const raw = toDataFrame({
    fields: [
      {
        name: 'trend',
        type,
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

function renderSparklineCell(field: Field, onTimeRangeSelected?: (range: AbsoluteTimeRange) => void) {
  return render(
    <SparklineCell
      field={field}
      rowIdx={0}
      theme={createTheme()}
      value={field.values[0]}
      width={width}
      onTimeRangeSelected={onTimeRangeSelected}
    />
  );
}

let uPlotInstance: InstanceType<typeof uPlot> | undefined;
jest.mock('../../../../utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() => uPlotInstance)
);

describe('TableNG SparklineCell threshold wiring (canvas)', () => {
  const realPrepareConfig = sparklineUtils.prepareConfig;
  let prepareConfigSpy: jest.SpyInstance;

  const assertCanvasOutput = async () => {
    await waitFor(() => expect(uPlotInstance?.status).toBe(1));
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

  // Reduce allValues types the column as FieldType.other, so nested frames never inherit
  // parent thresholds — SparklineCell must forward them for Scheme gradients.
  it('renders scheme gradient for reduce/allValues FieldType.other sparklines', async () => {
    expect(() =>
      renderSparklineCell(
        sparklineField(
          {
            custom: {
              cellOptions: { type: TableCellDisplayMode.Sparkline, gradientMode: GraphGradientMode.Scheme },
            },
            color: { mode: FieldColorModeId.Thresholds },
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'green' },
                { value: 80, color: 'red' },
              ],
            },
          },
          FieldType.other
        )
      )
    ).not.toThrow();

    await waitFor(() => expect(uPlotInstance?.status).toBe(1));
    await waitFor(() => expect(document.querySelector('.u-over')).toBeInTheDocument());
  });

  it.each(Object.values(GraphGradientMode))('renders %s gradient w/ continuous color mode', async (gradientMode) => {
    renderSparklineCell(
      sparklineField({
        custom: { cellOptions: { type: TableCellDisplayMode.Sparkline, gradientMode } },
        color: { mode: FieldColorModeId.ContinuousViridis },
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [{ value: -Infinity, color: 'green' }],
        },
      })
    );

    await assertCanvasOutput();
  });

  // The 5th positional prepareConfig arg is `enableHover`; the cell must forward
  // cellOptions.showTooltip so the sparkline only enables the cursor when opted in.
  it.each([
    [true, false, false],
    [false, false, false],
    [true, true, false],
    [true, false, true],
  ])(
    'selects time only when opted in and without data links or actions (option=%s, links=%s, actions=%s)',
    async (selectTimeRange, hasLinks, hasActions) => {
      const enabled = selectTimeRange && !hasLinks && !hasActions;
      const onTimeRangeSelected = jest.fn();
      renderSparklineCell(
        sparklineField({
          custom: { cellOptions: { type: TableCellDisplayMode.Sparkline, hideValue: true, selectTimeRange } },
          ...(hasLinks ? { links: [{ title: 'Details', url: 'https://example.com' }] } : {}),
          ...(hasActions ? { actions: [{ type: ActionType.Infinity, title: 'Run' }] } : {}),
        }),
        onTimeRangeSelected
      );
      await waitFor(() => expect(uPlotInstance?.status).toBe(1));
      expect(uPlotInstance!.cursor.drag?.x ?? false).toBe(enabled);
      const left = uPlotInstance!.valToPos(1000, 'x');
      const right = uPlotInstance!.valToPos(2000, 'x');
      uPlotInstance!.setSelect({ left, width: right - left, top: 0, height });
      if (enabled) {
        expect(onTimeRangeSelected).toHaveBeenCalledWith({ from: 1000, to: 2000 });
      } else {
        expect(onTimeRangeSelected).not.toHaveBeenCalled();
      }
    }
  );

  it('leaves hover disabled when showTooltip is unset', async () => {
    renderSparklineCell(sparklineField({ custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } } }));

    await waitFor(() => expect(uPlotInstance?.status).toBe(1));
    expect(prepareConfigSpy.mock.calls.at(-1)?.[4]).toBe(false);
  });

  it('forwards selected time ranges through the TableNG cell renderer', async () => {
    const onTimeRangeSelected = jest.fn();
    const field = sparklineField({
      custom: { cellOptions: { type: TableCellDisplayMode.Sparkline, hideValue: true, selectTimeRange: true } },
    });
    render(
      <TableNG
        data={{ fields: [field], length: 1 }}
        width={width}
        height={100}
        onTimeRangeSelected={onTimeRangeSelected}
      />
    );
    await waitFor(() => expect(uPlotInstance?.status).toBe(1));
    const plot = uPlotInstance!;
    const left = plot.valToPos(1000, 'x');
    plot.setSelect({ left, width: plot.valToPos(2000, 'x') - left, top: 0, height });
    expect(onTimeRangeSelected).toHaveBeenCalledWith({ from: 1000, to: 2000 });
  });

  it('enables hover when showTooltip is on', async () => {
    renderSparklineCell(
      sparklineField({ custom: { cellOptions: { type: TableCellDisplayMode.Sparkline, showTooltip: true } } })
    );

    await waitFor(() => expect(uPlotInstance?.status).toBe(1));
    expect(prepareConfigSpy.mock.calls.at(-1)?.[4]).toBe(true);
  });
});
