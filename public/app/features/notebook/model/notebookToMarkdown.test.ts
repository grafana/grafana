import { type PanelKind } from '@grafana/schema/apis/notebook/v2beta1';

import { insertElement, newCodeElement, newMarkdownElement, newNotebookSpec } from './notebookSpec';
import { notebookToMarkdown } from './notebookToMarkdown';

function panelElement(): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      id: 1,
      title: 'Latency p99',
      subtitle: 'From dashboard: Checkout',
      links: [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                refId: 'A',
                hidden: false,
                query: {
                  kind: 'DataQuery',
                  group: 'prometheus',
                  version: 'v0',
                  datasource: { name: 'prom-1' },
                  spec: { expr: 'histogram_quantile(0.99, http_request_duration_seconds_bucket)' },
                },
              },
            },
          ],
          transformations: [],
          queryOptions: {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: 'timeseries',
        version: '',
        spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      },
    },
  };
}

describe('notebookToMarkdown', () => {
  it('serializes title, meta and all cell types', () => {
    let spec = newNotebookSpec('Checkout investigation', { description: 'Latency spike', from: 'now-1h', to: 'now' });
    spec = { ...spec, tags: ['incident'] };
    spec = insertElement(spec, newMarkdownElement('## Symptoms\n\nLatency **spiked**.')).spec;
    spec = insertElement(spec, newCodeElement('sql', 'SELECT 1;')).spec;
    spec = insertElement(spec, panelElement()).spec;

    const markdown = notebookToMarkdown(spec, { notebookUrl: 'https://grafana.example/notebook/abc' });

    expect(markdown).toContain('# Checkout investigation');
    expect(markdown).toContain('Latency spike');
    expect(markdown).toContain('_Time range: now-1h → now_');
    expect(markdown).toContain('_Tags: incident_');
    expect(markdown).toContain('_Notebook: https://grafana.example/notebook/abc_');
    expect(markdown).toContain('## Symptoms');
    expect(markdown).toContain('```sql\nSELECT 1;\n```');
    expect(markdown).toContain('> 📊 **Latency p99** (timeseries)');
    expect(markdown).toContain('> From dashboard: Checkout');
    expect(markdown).toContain('`A` (prometheus): `histogram_quantile');
  });

  it('skips empty markdown cells', () => {
    let spec = newNotebookSpec('nb');
    spec = insertElement(spec, newMarkdownElement('   ')).spec;
    const markdown = notebookToMarkdown(spec);
    expect(markdown).toBe('# nb\n\n_Time range: now-6h → now_\n');
  });
});
