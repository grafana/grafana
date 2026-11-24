import { createDataFrame, createTheme, type DataFrame, FieldColorModeId, FieldType } from '@grafana/data';

import {
  applyStoryHighlight,
  layoutAnnotationLabels,
  CONTEXT_LINE_WIDTH,
  findLastIndexInRange,
  findSubjectNames,
  getAnnotationLabelText,
  spreadLabels,
} from './story';

const theme = createTheme();
const colors = { subject: '#ff5500', context: '#888888' };

function makeFrame(names: string[], custom: Record<string, unknown> = { lineWidth: 1, fillOpacity: 20 }): DataFrame {
  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2, 3] },
      ...names.map((name) => ({ name, type: FieldType.number, values: [1, 2, 3], config: { custom } })),
    ],
  });
}

function fieldNames(frames: DataFrame[]) {
  return frames.map((frame) => frame.fields.map((f) => f.name));
}

describe('findSubjectNames', () => {
  const names = ['cpu', 'CPU total', 'memory', 'disk io'];

  it.each([
    ['exact match ignores case', 'Cpu', ['cpu']],
    ['falls back to substring when nothing matches exactly', 'mem', ['memory']],
    ['substring fallback can match several series', 'o', ['CPU total', 'memory', 'disk io']],
    ['regex with flags', '/^cpu/i', ['cpu', 'CPU total']],
    ['regex without flags is case sensitive', '/^cpu/', ['cpu']],
    ['global flag does not skip matches', '/o/g', ['CPU total', 'memory', 'disk io']],
    ['invalid regex is matched as text', '/(/', []],
    ['blank input highlights nothing', '   ', []],
  ])('%s', (_, highlight, expected) => {
    expect([...findSubjectNames(names, highlight)]).toEqual(expected);
  });
});

describe('applyStoryHighlight', () => {
  it('returns the input frames untouched when nothing matches', () => {
    const frames = [makeFrame(['a', 'b'])];
    const result = applyStoryHighlight(frames, 'zzz', colors, theme);
    expect(result.frames).toBe(frames);
    expect(result.subjects.size).toBe(0);
  });

  it('returns the input frames untouched when highlight is empty', () => {
    const frames = [makeFrame(['a'])];
    expect(applyStoryHighlight(frames, '', colors, theme).frames).toBe(frames);
  });

  it('colours subjects with the accent and thickens them, keeping their fill', () => {
    const { frames } = applyStoryHighlight([makeFrame(['a', 'b'])], 'a', colors, theme);
    const subject = frames[0].fields.find((f) => f.name === 'a')!;

    expect(subject.config.color).toEqual({ mode: FieldColorModeId.Fixed, fixedColor: '#ff5500' });
    expect(subject.config.custom.lineWidth).toBe(2.5);
    expect(subject.config.custom.fillOpacity).toBe(20);
  });

  it('keeps a configured line width that is already thicker than the subject minimum', () => {
    const { frames } = applyStoryHighlight([makeFrame(['a'], { lineWidth: 4 })], 'a', colors, theme);
    expect(frames[0].fields[1].config.custom.lineWidth).toBe(4);
  });

  it('mutes context series: context colour, thin line, no fill, no per-series line colour', () => {
    const frame = makeFrame(['a', 'b'], { lineWidth: 3, fillOpacity: 50, lineColor: 'red' });
    const { frames } = applyStoryHighlight([frame], 'a', colors, theme);
    const context = frames[0].fields.find((f) => f.name === 'b')!;

    expect(context.config.color).toEqual({ mode: FieldColorModeId.Fixed, fixedColor: '#888888' });
    expect(context.config.custom.lineWidth).toBe(CONTEXT_LINE_WIDTH);
    expect(context.config.custom.fillOpacity).toBe(0);
    expect(context.config.custom.lineColor).toBeUndefined();
  });

  it('rebuilds the display processor so tooltips report the new colour', () => {
    const { frames } = applyStoryHighlight([makeFrame(['a', 'b'])], 'a', colors, theme);
    const [, ...values] = frames[0].fields;

    expect(values.map((f) => f.display!(1).color)).toEqual(['#888888', '#ff5500']);
  });

  it('draws subjects last: subject fields move to the end of their frame and their frames to the end', () => {
    const input = [makeFrame(['a', 'b']), makeFrame(['c', 'd'])];
    const { frames, subjects } = applyStoryHighlight(input, 'a', colors, theme);

    expect([...subjects]).toEqual(['a']);
    expect(fieldNames(frames)).toEqual([
      ['time', 'c', 'd'],
      ['time', 'b', 'a'],
    ]);
  });

  it('does not mutate the input frames', () => {
    const input = [makeFrame(['a', 'b'])];
    applyStoryHighlight(input, 'b', colors, theme);

    expect(fieldNames(input)).toEqual([['time', 'a', 'b']]);
    expect(input[0].fields[1].config.color).toBeUndefined();
  });
});

describe('findLastIndexInRange', () => {
  const xs = [10, 20, 30, 40, 50];

  it.each([
    ['last value in full range', [1, 2, 3, 4, 5], 0, 100, 4],
    ['skips trailing nulls', [1, 2, 3, null, undefined], 0, 100, 2],
    ['ignores points beyond the visible max', [1, 2, 3, 4, 5], 0, 35, 2],
    ['no value inside the range', [1, 2, null, null, null], 25, 100, -1],
    ['all points before the range', [1, 2, 3, 4, 5], 60, 100, -1],
  ])('%s', (_, ys, min, max, expected) => {
    expect(findLastIndexInRange(xs, ys, min, max)).toBe(expected);
  });
});

describe('spreadLabels', () => {
  it('leaves labels that do not collide where they are', () => {
    expect(spreadLabels([10, 50, 90], 12, 0, 100)).toEqual([10, 50, 90]);
  });

  it('pushes colliding labels down by one line height, in input order', () => {
    expect(spreadLabels([50, 40, 45], 10, 0, 100)).toEqual([60, 40, 50]);
  });

  it('keeps labels inside the bounds', () => {
    expect(spreadLabels([98, 99, 100], 10, 0, 100)).toEqual([80, 90, 100]);
    expect(spreadLabels([-5, 0, 1], 10, 6, 100)).toEqual([6, 16, 26]);
  });

  it('stacks from the top bound when there is not enough room', () => {
    expect(spreadLabels([5, 5, 5], 10, 0, 15)).toEqual([0, 10, 20]);
  });
});

describe('getAnnotationLabelText', () => {
  it.each([
    ['plain text', 'Deploy v2', 'Deploy v2'],
    ['first non-empty line', '\n  Deploy v2  \nrolled back later', 'Deploy v2'],
    ['markup removed and br splits lines', '<b>Deploy</b> v2<br/>details', 'Deploy v2'],
    ['collapses whitespace', 'Deploy   \t v2', 'Deploy v2'],
    ['non-string input', undefined, ''],
    ['empty text', '   ', ''],
  ])('%s', (_, text, expected) => {
    expect(getAnnotationLabelText(text)).toBe(expected);
  });

  it('truncates long text with an ellipsis within the limit', () => {
    const label = getAnnotationLabelText('Incident: checkout latency above SLO for the EU region', 40);
    expect(label).toBe('Incident: checkout latency above SLO fo…');
    expect(label.length).toBeLessThanOrEqual(40);
  });
});

describe('layoutAnnotationLabels', () => {
  const bounds = { offset: 3, gap: 8, minX: 0, maxX: 600, rows: 2, minWidth: 40 };
  const overlaps = (placements: ReturnType<typeof layoutAnnotationLabels>) =>
    placements.some((a, i) =>
      placements.some(
        (b, j) => a && b && i !== j && a.row === b.row && a.left < b.left + b.width && b.left < a.left + a.width
      )
    );

  it('sets well-spaced labels right of their lines in the first row', () => {
    expect(layoutAnnotationLabels([0, 200, 400], [100, 100, 100], bounds)).toEqual([
      { row: 0, left: 3, width: 100 },
      { row: 0, left: 203, width: 100 },
      { row: 0, left: 403, width: 100 },
    ]);
  });

  it('moves a label that would overlap into the second row', () => {
    const placements = layoutAnnotationLabels([0, 60], [100, 100], bounds);
    expect(placements.map((p) => p?.row)).toEqual([0, 1]);
    expect(overlaps(placements)).toBe(false);
  });

  it('flips a label left of its line near the right edge without overlapping earlier labels', () => {
    const placements = layoutAnnotationLabels([300, 560], [100, 100], bounds);
    expect(placements[1]).toEqual({ row: 0, left: 457, width: 100 });
    expect(overlaps(placements)).toBe(false);
  });

  it('truncates a label into the free gap when no row has room for all of it', () => {
    const placements = layoutAnnotationLabels([0, 20, 150, 170], [140, 140, 200, 200], bounds);
    expect(overlaps(placements)).toBe(false);
    expect(placements.every((p) => !p || p.left + p.width <= bounds.maxX)).toBe(true);
  });

  it('draws only the leader when even a truncated label cannot fit', () => {
    const placements = layoutAnnotationLabels([0, 10, 20], [400, 400, 400], { ...bounds, maxX: 420 });
    expect(placements[2]).toBeUndefined();
  });
});
