import { rangeUtil } from '@grafana/data';

import { deserializeNotebookLayout } from '../serialization/deserializeNotebookLayout';
import { defaultPanelKind } from '../types';

import { withCapturedTimeRange } from './captureTimeRange';

const absolute = rangeUtil.convertRawToRange(
  { from: '2026-09-25T10:15:00.000Z', to: '2026-09-25T10:25:00.000Z' },
  'utc'
);
const relative = rangeUtil.convertRawToRange({ from: 'now-1h', to: 'now' }, 'utc');

describe('captured panel time range', () => {
  it('stores the effective absolute window without changing the source panel', () => {
    const panel = defaultPanelKind();
    const captured = withCapturedTimeRange(panel, absolute, true);

    expect(captured.kind).toBe('Panel');
    if (captured.kind !== 'Panel') {
      throw new Error('Expected a panel');
    }
    expect(captured.spec.data.spec.queryOptions).toEqual(
      expect.objectContaining({ timeFrom: absolute.from.toISOString(), timeTo: absolute.to.toISOString() })
    );
    expect(panel.spec.data.spec.queryOptions.timeFrom).toBeUndefined();
  });

  it('loads a captured window as the notebook cell time range', () => {
    const captured = withCapturedTimeRange(defaultPanelKind(), absolute, true);
    const manager = deserializeNotebookLayout(
      {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'viz' }, source: 'user' },
            },
          ],
        },
      },
      { viz: captured }
    );

    expect(manager.state.cells[0].state.$timeRange?.state).toEqual(
      expect.objectContaining({ from: absolute.from.toISOString(), to: absolute.to.toISOString() })
    );
  });

  it('can lock a relative source to its current effective window', () => {
    const captured = withCapturedTimeRange(defaultPanelKind(), relative, true);
    expect(captured.kind === 'Panel' && captured.spec.data.spec.queryOptions).toEqual(
      expect.objectContaining({ timeFrom: relative.from.toISOString(), timeTo: relative.to.toISOString() })
    );
  });

  it('leaves an unlocked relative source following the notebook range', () => {
    const panel = defaultPanelKind();
    expect(withCapturedTimeRange(panel, relative, false)).toBe(panel);
  });

  it('clears an existing locked window when the user opts out', () => {
    const source = withCapturedTimeRange(defaultPanelKind(), absolute, true);
    const captured = withCapturedTimeRange(source, absolute, false);
    expect(captured.kind === 'Panel' && captured.spec.data.spec.queryOptions).toEqual(
      expect.objectContaining({ timeFrom: undefined, timeTo: undefined })
    );
  });
});
