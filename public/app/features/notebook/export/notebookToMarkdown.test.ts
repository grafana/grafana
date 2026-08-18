import {
  defaultSpec as defaultNotebookSpec,
  type NotebookElement,
  type PanelKind,
  type Spec as NotebookSpec,
} from '../types';

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

/** A panel carrying one prometheus query, a timeseries viz and no transformations. */
const panel: PanelKind = {
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

    it('omits the link when no url is given', () => {
      // The Cursor export leaves it out rather than stripping it back out afterwards, which could
      // not tell the generated line from an identical line in the notebook's own prose.
      const markdown = notebookToMarkdown(buildSpec({}, []), {});

      expect(markdown).not.toContain('**Link:**');
      expect(markdown).toContain('# Q2 latency regression');
    });

    it('keeps a Link-shaped line in the description, which stripping would have eaten', () => {
      const description = '- **Link:** see the runbook';

      const markdown = notebookToMarkdown(buildSpec({}, [], { description }), META);

      expect(markdown).toContain(description);
      expect(markdown).toContain('[Open in Grafana](https://host/notebooks/nb1?orgId=1)');
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

    it('drops a language that would break the fence', () => {
      // The schema allows any string here; a backtick or newline in the info string would end the
      // opening delimiter and render the code as prose.
      const spec = buildSpec({ q: codeElement('select 1', 'sql`\n```') }, ['q']);

      const markdown = notebookToMarkdown(spec, META);

      expect(markdown).toContain('```\nselect 1\n```');
      expect(markdown).not.toContain('sql`');
    });

    it('survives a code cell with very many backtick runs', () => {
      // Spreading these into Math.max would exceed the engine's argument limit and throw.
      const spec = buildSpec({ q: codeElement('`x`'.repeat(200000), 'text') }, ['q']);

      expect(() => notebookToMarkdown(spec, META)).not.toThrow();
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
    it('emits the panel title and the queries behind it', () => {
      // A chart has no markdown form, so the queries stand in for it — the part a reader can act on.
      const markdown = notebookToMarkdown(buildSpec({ p: panel }, ['p']), META);

      expect(markdown).toContain('### p95 latency');
      expect(markdown).toContain('"refId": "A"');
      expect(markdown).toContain('"datasource": "gdev-prometheus"');
      expect(markdown).toContain('"expr": "up == 0"');
    });

    // Datasource names are user-chosen and optional, so the plugin id is the only thing that says
    // whether `expr` above is PromQL or LogQL — the field a coding agent most needs.
    it('names the query language, not just the datasource', () => {
      expect(notebookToMarkdown(buildSpec({ p: panel }, ['p']), META)).toContain('"type": "prometheus"');
    });

    // The queries do not say whether this was a graph, a table or a single stat.
    it('notes the visualization type', () => {
      expect(notebookToMarkdown(buildSpec({ p: panel }, ['p']), META)).toContain('_timeseries panel_');
    });

    it('records whether a query is hidden', () => {
      // A disabled query would otherwise read as one the panel is actually running.
      const hidden: PanelKind = {
        ...panel,
        spec: {
          ...panel.spec,
          data: {
            kind: 'QueryGroup',
            spec: {
              ...panel.spec.data.spec,
              queries: [
                { ...panel.spec.data.spec.queries[0], spec: { ...panel.spec.data.spec.queries[0].spec, hidden: true } },
              ],
            },
          },
        },
      };

      expect(notebookToMarkdown(buildSpec({ p: hidden }, ['p']), META)).toContain('"hidden": true');
    });

    // The signal is "this one is disabled"; stating it on every active query is noise in every export.
    it('stays quiet about queries that are not hidden', () => {
      expect(notebookToMarkdown(buildSpec({ p: panel }, ['p']), META)).not.toContain('"hidden"');
    });

    describe('transformations', () => {
      function withTransformations(transformations: PanelKind['spec']['data']['spec']['transformations']) {
        const transformed: PanelKind = {
          ...panel,
          spec: {
            ...panel.spec,
            data: { kind: 'QueryGroup', spec: { ...panel.spec.data.spec, transformations } },
          },
        };

        return notebookToMarkdown(buildSpec({ p: transformed }, ['p']), META);
      }

      // A panel whose displayed value comes out of a transformation exports as queries that do not
      // produce it. Standing in for the chart is only honest if the gap is stated.
      it('marks a panel whose output the queries do not describe', () => {
        const markdown = withTransformations([
          { kind: 'Transformation', group: 'reduce', spec: { options: {} } },
          { kind: 'Transformation', group: 'organize', spec: { options: {} } },
        ]);

        expect(markdown).toContain('<!-- 2 transformation(s) applied; not represented below -->');
      });

      it('says nothing when there is nothing to warn about', () => {
        expect(withTransformations([])).not.toContain('transformation(s) applied');
      });
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

  /**
   * Go marshals a nil slice or map as `null` rather than omitting it — none of these fields carry
   * `omitempty` — while the generated TS types claim they are always present. It does not reproduce
   * through the UI, where a notebook comes from defaultNotebookSpec() and round-trips as `[]`; it
   * reproduces for one made by the Assistant, kubectl or provisioning, and the list row hands a raw
   * API spec straight in.
   *
   * One field at a time, so deleting any single guard fails exactly one of these rather than hiding
   * behind the others.
   */
  describe('null collections from the API', () => {
    function withNulls(overrides: Record<string, unknown>): NotebookSpec {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- expresses Go's null-for-nil payload against types that claim non-null
      return { ...buildSpec({ md: markdownElement('Findings') }, ['md']), ...overrides } as NotebookSpec;
    }

    it('exports a notebook whose tags came back null', () => {
      const markdown = notebookToMarkdown(withNulls({ tags: null }), META);

      expect(markdown).toContain('# Q2 latency regression');
      expect(markdown).not.toContain('**Tags:**');
    });

    it('exports a notebook whose cells came back null', () => {
      const spec = withNulls({});
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- as above
      spec.layout.spec.cells = null as unknown as NotebookSpec['layout']['spec']['cells'];

      expect(notebookToMarkdown(spec, META)).toContain('# Q2 latency regression');
    });

    it('exports a notebook whose elements came back null', () => {
      // The layout still references a cell, so this also covers dereferencing against no elements.
      expect(notebookToMarkdown(withNulls({ elements: null }), META)).toContain('# Q2 latency regression');
    });

    it('exports a panel whose queries came back null', () => {
      const noQueries: PanelKind = {
        ...panel,
        spec: {
          ...panel.spec,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- as above
          data: { kind: 'QueryGroup', spec: { ...panel.spec.data.spec, queries: null as unknown as [] } },
        },
      };

      expect(notebookToMarkdown(buildSpec({ p: noQueries }, ['p']), META)).toContain('_Panel with no queries._');
    });
  });
});
