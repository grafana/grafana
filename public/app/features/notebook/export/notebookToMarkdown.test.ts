import { defaultSpec as defaultNotebookSpec, type NotebookElement, type Spec as NotebookSpec } from '../types';

import { notebookToMarkdown } from './notebookToMarkdown';

const META = { url: 'https://host/notebooks/nb1?orgId=1' };

function markdownElement(text: string): NotebookElement {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

function codeElement(code: string, language: string): NotebookElement {
  return { kind: 'Cell', spec: { content: { kind: 'Code', spec: { code, language } } } };
}

function buildSpec(
  elements: Record<string, NotebookElement>,
  cellNames: string[],
  overrides: Partial<NotebookSpec> = {}
): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Q2 latency regression',
    tags: [],
    timeSettings: { ...defaultNotebookSpec().timeSettings, from: 'now-6h', to: 'now' },
    elements,
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: cellNames.map((name) => ({
          kind: 'NotebookLayoutItem',
          spec: { element: { kind: 'ElementReference', name }, source: 'user' },
        })),
      },
    },
    ...overrides,
  };
}

describe('notebookToMarkdown', () => {
  describe('header', () => {
    it('leads with the title and a link back to the notebook', () => {
      const markdown = notebookToMarkdown(buildSpec({}, []), META);

      expect(markdown).toContain('# Q2 latency regression');
      expect(markdown).toContain('- **Link:** [Open in Grafana](https://host/notebooks/nb1?orgId=1)');
      expect(markdown).toContain('- **Time range:** now-6h to now');
    });

    it('includes tags and description only when present', () => {
      const bare = notebookToMarkdown(buildSpec({}, []), META);
      expect(bare).not.toContain('**Tags:**');

      const full = notebookToMarkdown(
        buildSpec({}, [], { tags: ['incident', 'checkout'], description: 'What happened' }),
        META
      );
      expect(full).toContain('- **Tags:** incident, checkout');
      expect(full).toContain('What happened');
    });

    it('produces just the header for a notebook with no cells', () => {
      // An empty notebook must not crash the export.
      expect(notebookToMarkdown(buildSpec({}, []), META)).toContain('# Q2 latency regression');
    });
  });

  describe('cells', () => {
    it('follows the layout order, not the elements object', () => {
      // elements is a Record and carries no order; only the layout does.
      const spec = buildSpec({ second: markdownElement('Second'), first: markdownElement('First') }, [
        'first',
        'second',
      ]);

      const markdown = notebookToMarkdown(spec, META);

      expect(markdown.indexOf('First')).toBeLessThan(markdown.indexOf('Second'));
    });

    it('emits markdown verbatim, headings and all', () => {
      const text = '## Findings\n\np95 crossed 800ms. See `checkout`.\n\n- one\n- two';

      expect(notebookToMarkdown(buildSpec({ md: markdownElement(text) }, ['md']), META)).toContain(text);
    });

    it('fences code with its language', () => {
      const spec = buildSpec({ q: codeElement('up == 0', 'promql') }, ['q']);

      expect(notebookToMarkdown(spec, META)).toContain('```promql\nup == 0\n```');
    });

    it('grows the fence past a backtick run inside the code', () => {
      // A body containing ``` would otherwise close the block early and spill the rest as prose.
      const spec = buildSpec({ q: codeElement('a ``` b', 'sql') }, ['q']);

      expect(notebookToMarkdown(spec, META)).toContain('````sql\na ``` b\n````');
    });

    it('emits an element referenced by two layout items twice', () => {
      // Two cells may legitimately point at one element; deduping would silently drop a cell.
      const spec = buildSpec({ md: markdownElement('Repeated') }, ['md', 'md']);

      expect(notebookToMarkdown(spec, META).match(/Repeated/g)).toHaveLength(2);
    });

    it('skips a layout item whose element is missing rather than throwing', () => {
      const spec = buildSpec({ present: markdownElement('Here') }, ['gone', 'present']);

      const markdown = notebookToMarkdown(spec, META);

      expect(markdown).toContain('Here');
      expect(markdown).not.toContain('gone');
    });

    it('includes a collapsed cell — collapsed is view state, not content', () => {
      const spec = buildSpec({ md: markdownElement('Hidden in the UI') }, ['md']);
      spec.layout.spec.cells[0].spec.collapsed = true;

      expect(notebookToMarkdown(spec, META)).toContain('Hidden in the UI');
    });
  });

  describe('panels', () => {
    const panel: NotebookElement = {
      kind: 'Panel',
      spec: {
        id: 1,
        title: 'p95 latency',
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
                    datasource: { name: 'gdev-prometheus' },
                    spec: { expr: 'up == 0' },
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

    it('emits the panel title and the queries behind it', () => {
      // A chart has no markdown form, so the queries stand in for it — the part a reader can act on.
      const markdown = notebookToMarkdown(buildSpec({ p: panel }, ['p']), META);

      expect(markdown).toContain('### p95 latency');
      expect(markdown).toContain('"refId": "A"');
      expect(markdown).toContain('"datasource": "gdev-prometheus"');
      expect(markdown).toContain('"expr": "up == 0"');
    });

    it('says so when a panel has no queries', () => {
      const empty: NotebookElement = {
        ...panel,
        spec: {
          ...panel.spec,
          data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
        },
      };

      expect(notebookToMarkdown(buildSpec({ p: empty }, ['p']), META)).toContain('_Panel with no queries._');
    });

    it('names the library panel it references', () => {
      const library: NotebookElement = {
        kind: 'LibraryPanel',
        spec: { id: 2, title: 'CPU usage', libraryPanel: { uid: 'lib-cpu-1', name: 'CPU usage' } },
      };

      const markdown = notebookToMarkdown(buildSpec({ lib: library }, ['lib']), META);

      expect(markdown).toContain('### CPU usage');
      expect(markdown).toContain('_Library panel: CPU usage_');
    });
  });
});
