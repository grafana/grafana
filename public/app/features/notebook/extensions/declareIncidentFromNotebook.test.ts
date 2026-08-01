import { defaultSpec as defaultNotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import { newPanelForDatasource } from '../model/notebookSpec';

import { buildDeclareIncidentParams, declareIncidentContextFromSpec } from './declareIncidentFromNotebook';

describe('buildDeclareIncidentParams', () => {
  const originalLocation = window.location;

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, origin: 'https://grafana.example' },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('prefixes a named title and attaches the notebook link with a caption', () => {
    const params = buildDeclareIncidentParams({
      uid: 'nb1',
      title: 'Checkout latency',
      tags: ['checkout'],
      panelTitles: ['p99 latency'],
      firstMarkdownLine: 'some notes',
      description: 'API errors spiking',
    });

    // Named title beats markdown/description.
    expect(params.title).toBe('Investigation: Checkout latency');
    expect(params.url).toBe('https://grafana.example/notebook/nb1');
    expect(params.caption).toBe('Notebook: Checkout latency');
    expect(params.description).toContain('https://grafana.example/notebook/nb1');
    expect(params.description).toContain('Tags: checkout');
    expect(params.description).toContain('- p99 latency');
  });

  it('falls back to the first markdown line when the title is still the default', () => {
    const params = buildDeclareIncidentParams({
      uid: 'nb1',
      title: 'Untitled notebook',
      firstMarkdownLine: 'Checkout p99 over SLO in prod',
      description: 'API errors spiking in us-east',
    });

    expect(params.title).toBe('Checkout p99 over SLO in prod');
  });

  it('falls back to description when title is default and there is no markdown', () => {
    const params = buildDeclareIncidentParams({
      uid: 'nb1',
      title: 'New notebook',
      description: 'API errors spiking in us-east',
    });

    expect(params.title).toBe('API errors spiking in us-east');
  });

  it('does not double-prefix titles that already say Investigation', () => {
    const params = buildDeclareIncidentParams({
      uid: 'nb1',
      title: 'Investigation: payment timeouts',
    });

    expect(params.title).toBe('Investigation: payment timeouts');
  });
});

describe('declareIncidentContextFromSpec', () => {
  it('collects panel titles and the first markdown line from the notebook', () => {
    const panel = newPanelForDatasource({ uid: 'prom', type: 'prometheus' }, { title: 'Error rate' });
    const ctx = declareIncidentContextFromSpec('nb1', {
      ...defaultNotebookSpec(),
      title: 'Outage notes',
      elements: {
        md1: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '# Checkout p99\n\nDetails…' } } } },
        p1: panel,
      },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'md1' }, source: 'user' },
            },
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'p1' }, source: 'user' },
            },
          ],
        },
      },
    });

    expect(ctx.panelTitles).toEqual(['Error rate']);
    expect(ctx.firstMarkdownLine).toBe('Checkout p99');
  });
});
