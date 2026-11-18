import { createDataFrame } from '@grafana/data';

import { getSourceFrameIndex } from './columnContext';

describe('getSourceFrameIndex', () => {
  it.each([
    {
      name: 'matches a unique refId after frame order changes',
      frames: ['B', 'A'],
      sources: ['A', 'B'],
      index: 0,
      expected: 1,
    },
    {
      name: 'matches a single frame without a refId',
      frames: [undefined],
      sources: [undefined],
      index: 0,
      expected: 0,
    },
    { name: 'rejects a missing output frame', frames: ['A'], sources: ['A'], index: 1, expected: -1 },
    { name: 'rejects a missing source match', frames: ['A'], sources: ['B'], index: 0, expected: -1 },
    { name: 'rejects an empty source list', frames: ['A'], sources: [], index: 0, expected: -1 },
    { name: 'rejects duplicate output refIds', frames: ['A', 'A'], sources: ['A'], index: 0, expected: -1 },
    { name: 'rejects duplicate source refIds', frames: ['A'], sources: ['A', 'A'], index: 0, expected: -1 },
    {
      name: 'rejects ambiguous missing refIds',
      frames: [undefined, undefined],
      sources: [undefined],
      index: 0,
      expected: -1,
    },
  ])('$name', ({ frames, sources, index, expected }) => {
    const outputFrames = frames.map((refId) => createDataFrame({ refId, fields: [] }));
    const sourceFrames = sources.map((refId) => createDataFrame({ refId, fields: [] }));

    expect(getSourceFrameIndex(outputFrames, index, sourceFrames)).toBe(expected);
  });
});
