/**
 * Fixtures for the notebook mutation command suites.
 *
 * Builds real notebook scenes through the real transform, so the tests exercise the same path the page
 * loader takes. Nothing here mocks a serializer or a layout manager: the bugs this surface exists to
 * prevent are precisely losses in serialization, so a test that stubs it would pass while the thing
 * being tested is broken.
 *
 * The spec is written in the serializer's canonical form (explicit datasource per query, `description`
 * present on panels, `version: ''`) so spec -> scene -> spec is an exact round-trip.
 */

// defaultDataQueryKind is not re-exported by ../types (that seam covers the notebook-specific and
// forked names); it is a shared leaf type, so it comes straight from the generated module.
import { defaultDataQueryKind } from '@grafana/schema/apis/notebook/v2beta1';

import { notebookResourceFor } from '../api/notebookResource';
import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';
import { defaultSpec as defaultNotebookSpec, type NotebookElement, type Spec as NotebookSpec } from '../types';

export const NOTEBOOKS_FLAG = 'dashboard.notebooks';

export function markdownCell(text: string): NotebookElement {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

export function codeCell(code: string, language = 'promql'): NotebookElement {
  return { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language, code } } } };
}

export function panelCell(id: number, title: string): NotebookElement {
  return {
    kind: 'Panel',
    spec: {
      id,
      title,
      description: '',
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
                  version: defaultDataQueryKind().version,
                  group: 'prometheus',
                  // Explicit datasource: without a DSReferencesMapping the serializer writes the
                  // runtime-resolved datasource back, so only explicit refs round-trip exactly.
                  datasource: { name: 'gdev-prometheus' },
                  spec: { expr: 'up' },
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

interface NotebookSpecOverrides {
  title?: string;
  description?: string;
  tags?: string[];
  elements?: Record<string, NotebookElement>;
  /** Cell order, by element name. Anything not listed stays out of the layout. */
  cells?: string[];
  hideTimepicker?: boolean;
  autoRefresh?: string;
}

/**
 * A three-cell notebook: a markdown intro, a panel, and a code cell. The mix matters — a markdown or
 * code cell is not a viz panel, so a serializer that only walks panels drops them, which is the
 * regression these suites exist to catch.
 */
export function notebookSpec(overrides: NotebookSpecOverrides = {}): NotebookSpec {
  const elements =
    overrides.elements ??
    ({
      intro: markdownCell('## Checkout latency spike'),
      'latency-panel': panelCell(1, 'p95 latency'),
      query: codeCell('up == 0'),
    } satisfies Record<string, NotebookElement>);

  const cellNames = overrides.cells ?? Object.keys(elements);

  return {
    ...defaultNotebookSpec(),
    title: overrides.title ?? 'Checkout latency investigation',
    description: overrides.description ?? 'What happened on checkout during the deploy',
    tags: overrides.tags ?? ['incident', 'checkout'],
    timeSettings: {
      from: 'now-6h',
      to: 'now',
      timezone: 'utc',
      autoRefresh: overrides.autoRefresh ?? '',
      autoRefreshIntervals: ['5s', '30s', '1m'],
      hideTimepicker: overrides.hideTimepicker ?? false,
      fiscalYearStartMonth: 0,
    },
    elements,
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: cellNames.map((name) => ({
          kind: 'NotebookLayoutItem',
          spec: { element: { kind: 'ElementReference', name }, source: 'assistant' },
        })),
      },
    },
  };
}

/** An activated notebook scene, as the page would have it. */
export function notebookScene(spec: NotebookSpec = notebookSpec(), uid = 'nb-1'): NotebookScene {
  const scene = transformNotebookToScene(notebookResourceFor(uid, spec));
  scene.activate();
  return scene;
}

/** The element names the scene's cells currently reference, in document order. */
export function cellNamesOf(scene: NotebookScene): string[] {
  return scene.state.body.state.cells.map((cell) => cell.state.elementName);
}
