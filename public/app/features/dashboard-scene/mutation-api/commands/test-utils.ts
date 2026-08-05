/**
 * Fixtures for the full-spec command suites: a notebook and a dashboard built the way their pages
 * build one, plus the readers that pull an assertion out of a command result.
 *
 * One module because each command has its own suite now, and the alternative to sharing these is
 * five copies of a panel fixture that the serializer reads more of than any one case asserts on.
 */

import {
  defaultPanelKind as defaultDashboardPanelKind,
  defaultPanelSpec,
  type Spec as DashboardV2Spec,
  type PanelKind as DashboardPanelKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  defaultLibraryPanelKind,
  defaultPanelKind,
  type LibraryPanelKind,
  type PanelKind,
  type Spec as NotebookSpec,
} from '@grafana/schema/apis/notebook/v2beta1';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { buildNotebookEnvelope } from 'app/features/notebook/scene/buildNotebookEnvelope';
import { setNotebookDocumentHeader } from 'app/features/notebook/serialization/notebookSpecTransform';

import { type DashboardScene } from '../../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { type MutationContext } from './types';

// ---------------------------------------------------------------------------
// Notebook
// ---------------------------------------------------------------------------

export const timeSettings = {
  from: 'now-6h',
  to: 'now',
  autoRefresh: '',
  autoRefreshIntervals: ['5s', '1m'],
  hideTimepicker: false,
  fiscalYearStartMonth: 0,
  timezone: 'browser',
};

export function markdown(text: string) {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

export function code(language: string, source: string) {
  return { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language, code: source } } } };
}

export function cell(name: string, source: 'assistant' | 'user') {
  return { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name }, source } };
}

// Panel elements are built from the generated defaults rather than hand-written: the serializer
// reads more of a panel than any one test asserts on, so a partial fixture would only carry the
// fields I thought of and would go stale as the schema grows.
export function panelElement(id: number, title: string): PanelKind {
  const panel = defaultPanelKind();
  return {
    ...panel,
    spec: {
      ...panel.spec,
      id,
      title,
      data: {
        ...panel.spec.data,
        spec: {
          ...panel.spec.data.spec,
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                refId: 'A',
                hidden: false,
                query: { kind: 'DataQuery', group: 'prometheus', version: 'v0', spec: { expr: 'up' } },
              },
            },
          ],
        },
      },
      vizConfig: { ...panel.spec.vizConfig, group: 'timeseries', version: '1.0.0' },
    },
  };
}

export function libraryPanelElement(id: number, title: string, uid: string, name: string): LibraryPanelKind {
  const libraryPanel = defaultLibraryPanelKind();
  return { ...libraryPanel, spec: { ...libraryPanel.spec, id, title, libraryPanel: { uid, name } } };
}

export function makeNotebookSpec(overrides: Record<string, unknown> = {}): NotebookSpec {
  const spec = {
    title: 'Checkout latency investigation',
    description: 'p99 spike on the payments path',
    tags: ['incident', 'checkout'],
    timeSettings,
    elements: {
      intro: markdown('## What we know\n\np99 jumped at 14:02.'),
      repro: code('promql', 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))'),
    },
    layout: { kind: 'NotebookLayout', spec: { cells: [cell('intro', 'user'), cell('repro', 'assistant')] } },
    ...overrides,
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture matching the generated spec
  return spec as unknown as NotebookSpec;
}

/**
 * A notebook with a panel cell among the narrative ones.
 *
 * Kept separate from `makeNotebookSpec` because the cases above assert on the exact element set.
 * The panel's element name is deliberately not `panel-<id>`: the canonical name is what hides the
 * element-identity problem these cases are about, which is also why the dogfood seed avoids it.
 */
export function makeNotebookSpecWithPanel(): NotebookSpec {
  return makeNotebookSpec({
    elements: {
      intro: markdown('## What we know\n\np99 jumped at 14:02.'),
      'latency-panel': panelElement(1, 'p99 latency'),
      repro: code('promql', 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))'),
    },
    layout: {
      kind: 'NotebookLayout',
      spec: { cells: [cell('intro', 'user'), cell('latency-panel', 'assistant'), cell('repro', 'assistant')] },
    },
  });
}

/** Separate from the panel fixture so a library panel failure cannot be mistaken for a panel one. */
export function makeNotebookSpecWithLibraryPanel(): NotebookSpec {
  return makeNotebookSpec({
    elements: {
      intro: markdown('## What we know\n\np99 jumped at 14:02.'),
      'saved-view': libraryPanelElement(2, 'Checkout overview', 'lib-uid-1', 'Checkout overview'),
    },
    layout: {
      kind: 'NotebookLayout',
      spec: { cells: [cell('intro', 'user'), cell('saved-view', 'user')] },
    },
  });
}

/** Build a notebook scene exactly as NotebookScenePageStateManager does. */
export function buildNotebookScene(spec: NotebookSpec): DashboardScene {
  const envelope = buildNotebookEnvelope({
    apiVersion: 'notebook.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    spec,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  } as unknown as Parameters<typeof buildNotebookEnvelope>[0]);

  const scene = transformSaveModelSchemaV2ToScene(envelope);
  scene.setState({ meta: { ...scene.state.meta, isEmbedded: true } });
  setNotebookDocumentHeader(scene.state.body, spec.title, spec.tags);

  // Deliberately not activated: the full-spec commands serialize from scene state, and activating
  // would start the annotation data layer and the dashboard macro, which need a datasource srv the
  // spec surface has nothing to do with.
  return scene;
}

export function contextFor(scene: DashboardScene): MutationContext {
  return { scene };
}

export function referencedNames(spec: NotebookSpec): string[] {
  return spec.layout.spec.cells.map((c) => c.spec.element.name);
}

/** Cell references with no element to resolve to: the shape a lost cell takes in a spec. */
export function danglingReferences(spec: NotebookSpec): string[] {
  return referencedNames(spec).filter((name) => !spec.elements[name]);
}

/** The panel id an element carries, or undefined for a narrative cell. */
export function panelIdOf(spec: NotebookSpec, name: string): number | undefined {
  const element = spec.elements[name];
  return element && 'id' in element.spec ? element.spec.id : undefined;
}

/** The spec a read command returned. */
export function specOf(result: { data?: unknown }): NotebookSpec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: NotebookSpec }).spec;
}

/** The spec a write command echoed back, which is what a caller feeds into its next write. */
export function echoedSpecOf(result: { data?: unknown }): NotebookSpec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: NotebookSpec }).spec;
}

/** The document header, which the notebook layout manager holds on its own state. */
export function headerOf(scene: DashboardScene): { title?: string; tags?: string[] } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the header lives on the layout manager, not the scene
  const body = scene.state.body as unknown as { state: { title?: string; tags?: string[] } };
  return { title: body.state.title, tags: body.state.tags };
}

/** A dashboard scene, for the cases about a dashboard command meeting the wrong resource. */
export function stubDashboardScene(): DashboardScene {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the layout descriptor and meta are read
  return {
    state: { body: { descriptor: { id: 'GridLayout' } }, meta: {} },
    canEditDashboard: () => true,
  } as unknown as DashboardScene;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function dashboardPanelElement(id: number, title: string): DashboardPanelKind {
  const panel = defaultDashboardPanelKind();
  return {
    ...panel,
    spec: {
      ...panel.spec,
      id,
      title,
      data: {
        ...panel.spec.data,
        spec: {
          ...panel.spec.data.spec,
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                refId: 'A',
                hidden: false,
                query: { kind: 'DataQuery', group: 'prometheus', version: 'v0', spec: { expr: 'up' } },
              },
            },
          ],
        },
      },
      vizConfig: { ...panel.spec.vizConfig, group: 'timeseries', version: '1.0.0' },
    },
  };
}

export function gridItem(name: string, y: number) {
  return {
    kind: 'GridLayoutItem',
    spec: { x: 0, y, width: 12, height: 8, element: { kind: 'ElementReference', name } },
  };
}

/**
 * The loaded panel is named `latency-panel`, not `panel-1`: the canonical name is what hides an
 * element-identity problem, so a fixture using it would pass either way.
 */
export function makeDashboardSpec(overrides: Partial<DashboardV2Spec> = {}): DashboardV2Spec {
  const spec = {
    title: 'Checkout latency',
    description: '',
    cursorSync: 'Off',
    liveNow: false,
    preload: false,
    editable: true,
    tags: [],
    links: [],
    annotations: [],
    variables: [],
    timeSettings: {
      from: 'now-6h',
      to: 'now',
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '1m'],
      hideTimepicker: false,
      fiscalYearStartMonth: 0,
      timezone: 'browser',
    },
    elements: { 'latency-panel': dashboardPanelElement(1, 'p99 latency') },
    layout: { kind: 'GridLayout', spec: { items: [gridItem('latency-panel', 0)] } },
    ...overrides,
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture matching the generated spec
  return spec as unknown as DashboardV2Spec;
}

export function buildDashboardScene(spec: DashboardV2Spec): DashboardScene {
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;

  // Deliberately not activated, matching the notebook suite: the full-spec commands serialize from
  // scene state, and activating starts the annotation data layer and the dashboard macro.
  return transformSaveModelSchemaV2ToScene(dto);
}

export function dashboardReferencedNames(spec: DashboardV2Spec): string[] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the fixture is a grid layout throughout
  const items = (spec.layout as { spec: { items: Array<{ spec: { element: { name: string } } }> } }).spec.items;
  return items.map((item) => item.spec.element.name);
}

/** Layout references with no element to resolve to: the shape a lost panel takes in a spec. */
export function dashboardDanglingReferences(spec: DashboardV2Spec): string[] {
  return dashboardReferencedNames(spec).filter((name) => !spec.elements[name]);
}

/** A snapshot of the unsaved-changes baseline, which the reseed must leave alone. */
export function baselineOf(scene: DashboardScene): unknown {
  return JSON.parse(JSON.stringify(scene.serializer.initialSaveModel ?? null));
}
