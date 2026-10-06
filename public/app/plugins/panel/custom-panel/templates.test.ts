import { getDefaultDrawingCode, getStarterTemplates, type StarterTemplateId } from './templates';

// The shapes the sandbox hands to drawing code (see runtime/protocol.ts). Templates only run inside
// the frame, so the tests drive them the same way the frame bootstrap does: install a `panel`
// global, run the code, then call the registered draw with a context.
interface Field {
  name: string;
  displayName: string;
  type: string;
  values: Array<string | number | boolean | null>;
  lastDisplay?: string;
  lastColor?: string;
  thresholds?: Array<{ value: number | null; color: string }>;
}
interface Frame {
  refId?: string;
  name?: string;
  length: number;
  source?: { panelId: number; title?: string };
  fields: Field[];
}

function makeFrame({
  panelId,
  title,
  frameName,
  values,
  ...field
}: { panelId?: number; title?: string; frameName?: string; values: number[] } & Partial<Field>): Frame {
  return {
    refId: 'A',
    name: frameName,
    length: values.length,
    source: panelId === undefined ? undefined : { panelId, title },
    fields: [
      { name: 'time', displayName: 'time', type: 'time', values: values.map((_, i) => 1_700_000_000_000 + i * 60_000) },
      { name: 'value', displayName: 'value', type: 'number', values, ...field },
    ],
  };
}

const fakeHelpers = (series: Frame[]) => ({
  escapeHtml: (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
  frames: () => series,
  bySource: () => {
    const groups = new Map<number | null, { panelId: number | null; title: string | null; frames: Frame[] }>();
    for (const frame of series) {
      const panelId = frame.source?.panelId ?? null;
      const group = groups.get(panelId) ?? { panelId, title: frame.source?.title ?? null, frames: [] };
      group.frames.push(frame);
      groups.set(panelId, group);
    }
    return [...groups.values()];
  },
  field: (frame: Frame, nameOrType: string) =>
    frame.fields.find((f) => f.name === nameOrType || f.displayName === nameOrType) ??
    frame.fields.find((f) => f.type === nameOrType),
  last: (field: Field) => [...field.values].reverse().find((v) => v !== null) ?? null,
  formatTime: (ms: number) => new Date(ms).toISOString(),
});

function draw(
  code: string,
  { series = [], state = 'Done', variables = {} }: { series?: Frame[]; state?: string; variables?: object } = {}
) {
  let registered: ((ctx: unknown) => void) | undefined;
  new Function('panel', code)({ onRender: (fn: (ctx: unknown) => void) => (registered = fn) });
  const root = document.createElement('div');
  registered!({
    root,
    seq: 1,
    data: { state, series, errors: [] },
    timeRange: { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 0, 2), raw: { from: 'now-1d', to: 'now' } },
    timeZone: 'utc',
    variables,
    size: { width: 600, height: 300 },
    isRenderTarget: false,
    helpers: fakeHelpers(series),
  });
  return root;
}

const templateCode = (id: StarterTemplateId) => getStarterTemplates().find((template) => template.id === id)!.code;

const critical = [
  { value: null, color: 'green' },
  { value: 80, color: 'red' },
];

describe('starter templates', () => {
  it('offers the three templates and uses the KPI briefing as the default code', () => {
    expect(getStarterTemplates().map((template) => template.id)).toEqual(['kpi-briefing', 'incident-layout', 'blank']);
    expect(getDefaultDrawingCode()).toBe(templateCode('kpi-briefing'));
  });

  it.each(['kpi-briefing', 'incident-layout', 'blank'] as const)('%s registers exactly one draw callback', (id) => {
    const onRender = jest.fn();
    new Function('panel', templateCode(id))({ onRender });
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('kpi-briefing', () => {
    const series = [
      makeFrame({ panelId: 2, title: 'CPU', values: [10, 20, 30], lastDisplay: '30%', lastColor: 'rgb(0, 128, 0)' }),
      makeFrame({ panelId: 3, title: 'Memory', values: [50, 40], lastDisplay: '40 MB' }),
    ];

    it('draws one linked card per source panel with its last value and change', () => {
      const root = draw(templateCode('kpi-briefing'), { series });
      const cards = [...root.querySelectorAll('.card')];

      expect(cards.map((card) => card.getAttribute('href'))).toEqual(['#panel-2', '#panel-3']);
      expect(cards.map((card) => card.querySelector('.title')!.textContent)).toEqual(['CPU', 'Memory']);
      expect(cards.map((card) => card.querySelector('.value')!.textContent)).toEqual(['30%', '40 MB']);
      expect(cards.map((card) => card.querySelector('.delta')!.textContent)).toEqual(['▲ +200.0%', '▼ -20.0%']);
      expect(root.querySelector<HTMLElement>('.card .value')!.style.color).toBe('rgb(0, 128, 0)');
    });

    it('summarises how many metrics went up and shows the time range', () => {
      const root = draw(templateCode('kpi-briefing'), { series });

      expect(root.querySelector('.summary')!.textContent).toBe('1 of 2 metrics up since range start');
      expect(root.querySelector('.range')!.textContent).toBe('2026-01-01T00:00:00.000Z – 2026-01-02T00:00:00.000Z');
    });

    it('caps the sparkline at 200 points', () => {
      const values = Array.from({ length: 1000 }, (_, i) => i);
      const root = draw(templateCode('kpi-briefing'), { series: [makeFrame({ panelId: 1, values })] });
      const points = root.querySelector('polyline')!.getAttribute('points')!.split(' ');

      expect(points).toHaveLength(200);
      expect(points[0]).toBe('0.00,28.00');
      expect(points[199]).toBe('100.00,2.00');
    });

    it('escapes source titles', () => {
      const root = draw(templateCode('kpi-briefing'), {
        series: [makeFrame({ panelId: 1, title: '<img src=x onerror=alert(1)>', values: [1, 2] })],
      });

      expect(root.querySelector('img')).toBeNull();
      expect(root.querySelector('.title')!.textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('gives frames without a source panel an unlinked card each', () => {
      const root = draw(templateCode('kpi-briefing'), {
        series: [
          makeFrame({ frameName: 'requests', values: [1, 2] }),
          makeFrame({ frameName: 'errors', values: [2, 1] }),
        ],
      });
      const cards = [...root.querySelectorAll('.card')];

      expect(cards.map((card) => card.tagName)).toEqual(['DIV', 'DIV']);
      expect(cards.map((card) => card.querySelector('.title')!.textContent)).toEqual(['requests', 'errors']);
    });

    it.each([
      ['Done', 'No data to show'],
      ['Loading', 'Loading…'],
    ])('shows an empty state when there is no data (%s)', (state, text) => {
      const root = draw(templateCode('kpi-briefing'), { state });

      expect(root.querySelector('.card')).toBeNull();
      expect(root.querySelector('.empty')!.textContent).toBe(text);
    });
  });

  describe('incident-layout', () => {
    it('shows the incident banner and the critical offenders by severity when a metric crosses its last threshold', () => {
      const root = draw(templateCode('incident-layout'), {
        series: [
          makeFrame({ panelId: 2, title: 'Latency', values: [50, 90], lastDisplay: '90 ms', thresholds: critical }),
          makeFrame({ panelId: 3, title: 'Errors', values: [10, 160], lastDisplay: '160', thresholds: critical }),
          makeFrame({ panelId: 4, title: 'Traffic', values: [5, 6], thresholds: critical }),
        ],
      });

      expect(root.querySelector('[role="alert"]')!.textContent).toBe('Incident: 2 of 3 signals critical');
      expect([...root.querySelectorAll('.offender')].map((el) => el.getAttribute('href'))).toEqual([
        '#panel-3',
        '#panel-2',
      ]);
      expect(root.querySelector('.others summary')!.textContent).toBe('1 other signals');
      expect(root.querySelector('.others li')!.textContent).toBe('Traffic: 6');
    });

    it('stays calm when every metric is below its last threshold', () => {
      const root = draw(templateCode('incident-layout'), {
        series: [makeFrame({ panelId: 2, title: 'Latency', values: [50, 79], thresholds: critical })],
      });

      expect(root.querySelector('[role="alert"]')).toBeNull();
      expect(root.querySelector('.calm')!.textContent).toBe('All clear: 1 signals below their critical thresholds');
      expect(root.querySelector('.tile')!.getAttribute('href')).toBe('#panel-2');
    });

    it('never treats a single threshold step as critical', () => {
      const root = draw(templateCode('incident-layout'), {
        series: [makeFrame({ panelId: 2, values: [1000], thresholds: [{ value: null, color: 'green' }] })],
      });

      expect(root.querySelector('[role="alert"]')).toBeNull();
    });

    it.each([
      ['off', [95], false],
      ['on', [10], true],
    ])('lets incident_mode=%s force the mode', (mode, values, banner) => {
      const root = draw(templateCode('incident-layout'), {
        series: [makeFrame({ panelId: 2, title: 'Latency', values, thresholds: critical })],
        variables: { incident_mode: { value: mode, text: mode } },
      });

      expect(root.querySelector('[role="alert"]') !== null).toBe(banner);
    });
  });

  it('blank reports the frame count and state', () => {
    const root = draw(templateCode('blank'), { series: [makeFrame({ values: [1] })] });

    expect(root.textContent).toBe('1 frame(s), state: Done');
  });
});
