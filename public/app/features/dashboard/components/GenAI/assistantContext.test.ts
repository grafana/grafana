import { Dashboard, Panel } from '@grafana/schema';

import { buildPanelContext, hasMeaningfulPanelContext } from './assistantContext';

function makePanel(overrides: Partial<Panel> = {}): Panel {
  return {
    id: 1,
    title: 'Test panel',
    type: 'timeseries',
    gridPos: { x: 0, y: 0, w: 12, h: 8 },
    ...overrides,
  };
}

describe('hasMeaningfulPanelContext', () => {
  it('returns false for a new panel without datasource, queries, or content', () => {
    expect(hasMeaningfulPanelContext(makePanel())).toBe(false);
  });

  it('returns true when the panel has a datasource uid', () => {
    expect(
      hasMeaningfulPanelContext(
        makePanel({
          datasource: {
            type: 'prometheus',
            uid: 'prometheus-uid',
          },
        })
      )
    ).toBe(true);
  });

  it('returns true when the panel has a datasource name', () => {
    expect(
      hasMeaningfulPanelContext(
        makePanel({
          datasource: {
            type: 'prometheus',
            name: 'Prometheus',
          },
        })
      )
    ).toBe(true);
  });

  it('returns true when the panel has a query expression', () => {
    expect(
      hasMeaningfulPanelContext(
        makePanel({
          targets: [{ expr: 'rate(http_requests_total[5m])' }],
        })
      )
    ).toBe(true);
  });

  it('returns true when a text panel has content', () => {
    expect(
      hasMeaningfulPanelContext(
        makePanel({
          type: 'text',
          options: {
            content: '# Hello',
          },
        })
      )
    ).toBe(true);
  });
});

describe('buildPanelContext', () => {
  it('includes datasource identity when available', () => {
    const context = buildPanelContext(
      makePanel({
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
          name: 'Prometheus',
        },
      }),
      {
        title: 'Service overview',
      } as Dashboard
    );

    expect(context).toContain('"type": "prometheus"');
    expect(context).toContain('"uid": "prometheus-uid"');
    expect(context).toContain('"name": "Prometheus"');
  });
});
