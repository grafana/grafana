import type uPlot from 'uplot';

import { createTheme, ThresholdsMode } from '@grafana/data';
import { GraphThresholdsStyleMode, ScaleOrientation } from '@grafana/schema';

import { getThresholdsDrawHook } from './UPlotThresholds';

function makeCtx() {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    setLineDash: jest.fn(),
    createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
  };
}

function makeUPlot() {
  const ctx = makeCtx();
  return {
    ctx,
    bbox: { left: 0, top: 0, width: 200, height: 100 },
    scales: {
      x: { min: 0 as number | null, max: 100 as number | null, ori: ScaleOrientation.Horizontal as number },
      y: { min: 0 as number | null, max: 100 as number | null },
    },
    valToPos: jest.fn(() => 50),
  };
}

function asUPlot(u: ReturnType<typeof makeUPlot>): uPlot {
  return u as unknown as uPlot;
}

const theme = createTheme();

const basicThresholds = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 50, color: 'red' },
  ],
};

describe('getThresholdsDrawHook', () => {
  it('returns early without drawing when scale min or max is null', () => {
    const noMin = makeUPlot();
    noMin.scales.x.min = null;
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.Line },
      theme,
    })(asUPlot(noMin));
    expect(noMin.ctx.save).not.toHaveBeenCalled();

    const noMax = makeUPlot();
    noMax.scales.y.max = null;
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.Line },
      theme,
    })(asUPlot(noMax));
    expect(noMax.ctx.save).not.toHaveBeenCalled();
  });

  it('draws a horizontal threshold line (constant y, spanning the plot width) in Line mode', () => {
    const u = makeUPlot();
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.Line },
      theme,
    })(asUPlot(u));
    expect(u.ctx.save).toHaveBeenCalled();
    // horizontal orientation => line runs at a constant y (the threshold position, 50) across the bbox width
    expect(u.ctx.moveTo).toHaveBeenCalledWith(0, 50);
    expect(u.ctx.lineTo).toHaveBeenCalledWith(200, 50);
    expect(u.ctx.stroke).toHaveBeenCalled();
    expect(u.ctx.fillRect).not.toHaveBeenCalled();
    expect(u.ctx.setLineDash).toHaveBeenCalledWith([]);
  });

  it('does not draw any lines when only the base (-Infinity) threshold exists', () => {
    const u = makeUPlot();
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: { mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: 'green' }] },
      config: { mode: GraphThresholdsStyleMode.Line },
      theme,
    })(asUPlot(u));
    expect(u.ctx.beginPath).not.toHaveBeenCalled();
  });

  it('uses a [10,10] dash pattern in Dashed mode', () => {
    const u = makeUPlot();
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.Dashed },
      theme,
    })(asUPlot(u));
    expect(u.ctx.setLineDash).toHaveBeenCalledWith([10, 10]);
  });

  it('fills the area without drawing lines in Area mode', () => {
    const u = makeUPlot();
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.Area },
      theme,
    })(asUPlot(u));
    expect(u.ctx.fillRect).toHaveBeenCalled();
    expect(u.ctx.beginPath).not.toHaveBeenCalled();
  });

  it('draws both fill and lines in LineAndArea mode', () => {
    const u = makeUPlot();
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.LineAndArea },
      theme,
    })(asUPlot(u));
    expect(u.ctx.fillRect).toHaveBeenCalled();
    expect(u.ctx.beginPath).toHaveBeenCalled();
  });

  it('draws both fill and dashed lines in DashedAndArea mode', () => {
    const u = makeUPlot();
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.DashedAndArea },
      theme,
    })(asUPlot(u));
    expect(u.ctx.fillRect).toHaveBeenCalled();
    expect(u.ctx.setLineDash).toHaveBeenCalledWith([10, 10]);
  });

  it('re-maps step values from percentage to absolute before drawing', () => {
    const u = makeUPlot();
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: 0, color: 'green' },
          { value: 50, color: 'yellow' },
          { value: 80, color: 'red' },
        ],
      },
      config: { mode: GraphThresholdsStyleMode.Line },
      theme,
      hardMin: 0,
      hardMax: 200,
    })(asUPlot(u));
    const calledValues = u.valToPos.mock.calls.map((c: unknown[]) => c[0]);
    expect(calledValues).toContain(100);
    expect(calledValues).toContain(160);
  });

  it('falls back to the previous step color when a step is transparent', () => {
    const strokeStyles: string[] = [];
    const u = makeUPlot();
    const originalStroke = u.ctx.stroke;
    u.ctx.stroke = jest.fn(() => {
      strokeStyles.push(u.ctx.strokeStyle as string);
      return originalStroke();
    });
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 30, color: 'transparent' },
          { value: 70, color: 'red' },
        ],
      },
      config: { mode: GraphThresholdsStyleMode.Line },
      theme,
    })(asUPlot(u));
    expect(strokeStyles.length).toBeGreaterThan(0);
    expect(strokeStyles.every((s) => !s.includes('transparent'))).toBe(true);
    expect(strokeStyles[0]).toContain('rgba(');
  });

  it('draws a vertical threshold line (constant x, spanning the plot height) in vertical scale orientation', () => {
    const u = makeUPlot();
    u.scales.x.ori = ScaleOrientation.Vertical;
    getThresholdsDrawHook({
      scaleKey: 'y',
      thresholds: basicThresholds,
      config: { mode: GraphThresholdsStyleMode.Line },
      theme,
    })(asUPlot(u));
    // vertical orientation swaps the axes: the line runs at a constant x (50) from the top to the bottom of the bbox
    expect(u.ctx.moveTo).toHaveBeenCalledWith(50, 0);
    expect(u.ctx.lineTo).toHaveBeenCalledWith(50, 100);
    expect(u.ctx.stroke).toHaveBeenCalled();
  });
});
