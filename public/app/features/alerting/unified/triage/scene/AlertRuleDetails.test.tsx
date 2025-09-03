import { DataFrame, Labels, PanelData } from '@grafana/data';

import { extractAlertInstances } from './AlertRuleDetails';

function makeFrame(times: number[], state: 'firing' | 'pending', otherLabels: Labels = { node: 'cpu1' }): DataFrame {
  const valueLabels: Labels = {
    alertstate: state,
    ...otherLabels,
  };

  return {
    fields: [
      { name: 'Time', type: 'time', values: times },
      { name: 'Value', type: 'number', values: new Array(times.length).fill(1), labels: valueLabels },
    ],
  } as unknown as DataFrame;
}

function makePanelData(frames: DataFrame[]): PanelData {
  return {
    state: 'Done',
    series: frames,
    timeRange: undefined as any,
  } as unknown as PanelData;
}

describe('AlertInstanceScene', () => {
  describe('extractAlertInstances', () => {
    it('returns empty array when no series', () => {
      const data = makePanelData([]);
      expect(extractAlertInstances(data)).toEqual([]);
    });

    it('merges firing and pending series that only differ by alertstate', () => {
      // Minimal functional payload inspired by the provided example
      const firingTimes = [1756367070000, 1756367100000, 1756367130000];
      const pendingTimes = [1756367670000, 1756367700000, 1756367730000];

      const firingFrame = makeFrame(firingTimes, 'firing', { node: 'cpu1' });
      const pendingFrame = makeFrame(pendingTimes, 'pending', { node: 'cpu1' });

      const data = makePanelData([firingFrame, pendingFrame]);
      const result = extractAlertInstances(data);

      // Expect a single merged instance with common labels only (without alertstate/grafana_alertstate)
      expect(result.length).toBe(1);
      expect(result[0].labels).toEqual({ node: 'cpu1' });
      expect(result[0].labelSelector).toEqual('node="cpu1"');

      // Expect combined timeline containing both pending and firing states
      const timeline = result[0].timeline;
      expect(timeline).toEqual([
        [1756367070000, 'firing'],
        [1756367100000, 'firing'],
        [1756367130000, 'firing'],
        [1756367670000, 'pending'],
        [1756367700000, 'pending'],
        [1756367730000, 'pending'],
      ]);
    });

    it('when timestamps overlap, firing takes precedence over pending', () => {
      const overlappingTime = 1756368000000;
      const firingFrame = makeFrame([overlappingTime], 'firing', { node: 'cpu1' });
      const pendingFrame = makeFrame([overlappingTime], 'pending', { node: 'cpu1' });

      const data = makePanelData([firingFrame, pendingFrame]);
      const result = extractAlertInstances(data);

      expect(result.length).toBe(1);
      expect(result[0].labels).toEqual({ node: 'cpu1' });
      expect(result[0].labelSelector).toEqual('node="cpu1"');
      expect(result[0].timeline).toEqual([[overlappingTime, 'firing']]);
    });

    // No grafana_alertstate label is present in any of the frames in these tests
  });
});
