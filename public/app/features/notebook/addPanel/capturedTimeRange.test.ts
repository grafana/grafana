import { dateTime } from '@grafana/data';

import { deserializeNotebookLayout } from '../serialization/deserializeNotebookLayout';
import { defaultLibraryPanelKind, defaultPanelKind, type PanelKind } from '../types';

import {
  captureTimeRange,
  describeCapturedTimeRange,
  shouldLockCapturedTimeRange,
  withCapturedTimeRange,
} from './capturedTimeRange';

describe('captureTimeRange', () => {
  it('keeps a relative end as the string the picker wrote', () => {
    expect(captureTimeRange({ from: 'now-6h', to: 'now' })).toEqual({ from: 'now-6h', to: 'now', timeZone: undefined });
  });

  // A zoomed dashboard hands over DateTimes rather than strings, and the cell time range stores
  // strings — so the instants have to survive the conversion exactly.
  it('serializes an absolute end to its ISO instant', () => {
    const captured = captureTimeRange(
      { from: dateTime('2026-10-05T08:00:00.000Z'), to: dateTime('2026-10-05T09:30:00.000Z') },
      'utc'
    );

    expect(captured).toEqual({ from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:30:00.000Z', timeZone: 'utc' });
  });
});

describe('shouldLockCapturedTimeRange', () => {
  it.each([
    {
      desc: 'both ends absolute, as a zoom leaves them',
      from: '2026-10-05T08:00:00.000Z',
      to: '2026-10-05T09:30:00.000Z',
      expected: true,
    },
    { desc: 'an absolute start through now', from: '2026-10-05T08:00:00.000Z', to: 'now', expected: true },
    { desc: 'a relative start to an absolute end', from: 'now-6h', to: '2026-10-05T09:30:00.000Z', expected: true },
    { desc: 'a relative window', from: 'now-6h', to: 'now', expected: false },
    { desc: 'a rounded relative window', from: 'now-1d/d', to: 'now-1d/d', expected: false },
  ])('is $expected for $desc', ({ from, to, expected }) => {
    expect(shouldLockCapturedTimeRange({ from, to })).toBe(expected);
  });
});

describe('describeCapturedTimeRange', () => {
  it('names a relative window the way the time picker does', () => {
    expect(describeCapturedTimeRange({ from: 'now-6h', to: 'now', timeZone: 'utc' })).toBe('Last 6 hours');
  });

  // Stored as ISO strings, which describeTimeRange prints verbatim unless they are resolved first.
  it('formats an absolute window as dates rather than ISO strings', () => {
    expect(
      describeCapturedTimeRange({ from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:30:00.000Z', timeZone: 'utc' })
    ).toBe('2026-10-05 08:00:00 to 2026-10-05 09:30:00');
  });
});

describe('withCapturedTimeRange', () => {
  function panel(): PanelKind {
    const base = defaultPanelKind();
    return { ...base, spec: { ...base.spec, id: 1, title: 'p95 latency' } };
  }

  // The pair is what deserializeNotebookLayout reads back as a locked cell range; one alone is an
  // ordinary dashboard-style override and would not lock anything.
  it('writes the window as the query options the notebook reads back as a cell range', () => {
    const locked = withCapturedTimeRange(panel(), {
      from: '2026-10-05T08:00:00.000Z',
      to: '2026-10-05T09:30:00.000Z',
    });

    expect(locked.kind).toBe('Panel');
    expect((locked as PanelKind).spec.data.spec.queryOptions).toMatchObject({
      timeFrom: '2026-10-05T08:00:00.000Z',
      timeTo: '2026-10-05T09:30:00.000Z',
    });
  });

  it('leaves the rest of the panel alone', () => {
    const locked = withCapturedTimeRange(panel(), { from: 'now-6h', to: 'now' });

    expect((locked as PanelKind).spec.title).toBe('p95 latency');
    expect((locked as PanelKind).spec.id).toBe(1);
  });

  // The captured window is the one the shifted panel was showing, so the shift is already in it.
  // Left on the element, the notebook would build a PanelTimeRange under the cell's locked range on
  // load and query a window moved twice.
  describe('a panel with a time shift', () => {
    function shiftedPanel(): PanelKind {
      const base = panel();
      return {
        ...base,
        spec: {
          ...base.spec,
          data: {
            ...base.spec.data,
            spec: { ...base.spec.data.spec, queryOptions: { timeShift: '2h', timeCompare: '1d' } },
          },
        },
      };
    }

    const window = { from: '2026-10-05T06:00:00.000Z', to: '2026-10-05T07:00:00.000Z' };

    it('drops the shift it has already consumed and keeps the comparison', () => {
      const { queryOptions } = (withCapturedTimeRange(shiftedPanel(), window) as PanelKind).spec.data.spec;

      expect(queryOptions.timeShift).toBeUndefined();
      expect(queryOptions.timeCompare).toBe('1d');
    });

    it('loads into the notebook querying the captured window, not a window shifted again', () => {
      const locked = withCapturedTimeRange(shiftedPanel(), window);
      const layout = deserializeNotebookLayout(
        {
          kind: 'NotebookLayout',
          spec: {
            cells: [
              {
                kind: 'NotebookLayoutItem',
                spec: { element: { kind: 'ElementReference', name: 'p' }, source: 'user' },
              },
            ],
          },
        },
        { p: locked }
      );
      const [cell] = layout.state.cells;
      const panelTimeRange = cell.state.body!.state.$timeRange;

      expect(cell.state.$timeRange?.state).toMatchObject(window);
      // What remains on the panel is the comparison alone, running beside the locked window.
      expect(panelTimeRange?.state).toMatchObject({ compareWith: '1d', timeShift: undefined });
    });
  });

  // A library panel reference has no query options to write to, so the capture lands unlocked
  // rather than being refused.
  it('returns a library panel reference unchanged', () => {
    const reference = defaultLibraryPanelKind();

    expect(withCapturedTimeRange(reference, { from: '2026-10-05T08:00:00.000Z', to: 'now' })).toEqual(reference);
  });
});
