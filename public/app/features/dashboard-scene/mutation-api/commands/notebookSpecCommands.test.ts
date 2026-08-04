/**
 * End-to-end cover for the full-spec surface on a notebook: a real notebook scene, built the way
 * the notebook page builds one, driven through the real GET_SPEC / APPLY_SPEC handlers and the
 * real serializer. Deliberately unmocked — the bugs this replaces were all in the seams between
 * those pieces (elements derived from viz panels only, a dashboard-shaped spec handed back for a
 * notebook resource, a permission rule that refused every notebook write).
 */

import { config } from '@grafana/runtime';
import {
  defaultLibraryPanelKind,
  defaultPanelKind,
  type LibraryPanelKind,
  type PanelKind,
  type Spec as NotebookSpec,
} from '@grafana/schema/apis/notebook/v2beta1';
import { contextSrv } from 'app/core/services/context_srv';
import { buildNotebookEnvelope } from 'app/features/notebook/scene/buildNotebookEnvelope';
import { AccessControlAction } from 'app/types/accessControl';

import { type DashboardScene } from '../../scene/DashboardScene';
import { setNotebookDocumentHeader } from '../../serialization/notebookSpecTransform';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { applySpecCommand } from './applySpec';
import { getSpecCommand } from './getSpec';
import { type MutationContext } from './types';

let notebooksFlagEnabled = true;

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => notebooksFlagEnabled }),
}));

const timeSettings = {
  from: 'now-6h',
  to: 'now',
  autoRefresh: '',
  autoRefreshIntervals: ['5s', '1m'],
  hideTimepicker: false,
  fiscalYearStartMonth: 0,
  timezone: 'browser',
};

function markdown(text: string) {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

function code(language: string, source: string) {
  return { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language, code: source } } } };
}

function cell(name: string, source: 'assistant' | 'user') {
  return { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name }, source } };
}

// Panel elements are built from the generated defaults rather than hand-written: the serializer
// reads more of a panel than any one test asserts on, so a partial fixture would only carry the
// fields I thought of and would go stale as the schema grows.
function panelElement(id: number, title: string): PanelKind {
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

function libraryPanelElement(id: number, title: string, uid: string, name: string): LibraryPanelKind {
  const libraryPanel = defaultLibraryPanelKind();
  return { ...libraryPanel, spec: { ...libraryPanel.spec, id, title, libraryPanel: { uid, name } } };
}

function makeNotebookSpec(overrides: Record<string, unknown> = {}): NotebookSpec {
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
function makeNotebookSpecWithPanel(): NotebookSpec {
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
function makeNotebookSpecWithLibraryPanel(): NotebookSpec {
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
function buildNotebookScene(spec: NotebookSpec): DashboardScene {
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

function contextFor(scene: DashboardScene): MutationContext {
  return { scene };
}

async function getSpec(scene: DashboardScene, validate = false) {
  return getSpecCommand.handler({ validate }, contextFor(scene));
}

async function applySpec(scene: DashboardScene, spec: unknown, validate = false) {
  return applySpecCommand.handler({ spec: spec as Record<string, unknown>, validate }, contextFor(scene));
}

/** The notebook spec carried by a GET_SPEC result. */
function specOf(result: Awaited<ReturnType<typeof getSpec>>): NotebookSpec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: NotebookSpec }).spec;
}

/** The notebook spec APPLY_SPEC echoes back, which is what a caller feeds into its next write. */
function echoedSpecOf(result: Awaited<ReturnType<typeof applySpec>>): NotebookSpec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: NotebookSpec }).spec;
}

function referencedNames(spec: NotebookSpec): string[] {
  return spec.layout.spec.cells.map((c) => c.spec.element.name);
}

/** Cell references with no element to resolve to: the shape a lost cell takes in a spec. */
function danglingReferences(spec: NotebookSpec): string[] {
  return referencedNames(spec).filter((name) => !spec.elements[name]);
}

/** The panel id an element carries, or undefined for a narrative cell. */
function panelIdOf(spec: NotebookSpec, name: string): number | undefined {
  const element = spec.elements[name];
  return element && 'id' in element.spec ? element.spec.id : undefined;
}

beforeEach(() => {
  notebooksFlagEnabled = true;
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET_SPEC on a notebook', () => {
  it('reports the notebook resource', async () => {
    const result = await getSpec(buildNotebookScene(makeNotebookSpec()));

    expect(result.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped
    expect((result.data as { resource: string }).resource).toBe('notebook');
  });

  // The regression this whole change exists for: elements used to be derived from getVizPanels(),
  // so every markdown and code cell vanished while the layout kept referencing it by name.
  it('keeps narrative cells instead of dropping them', async () => {
    const spec = specOf(await getSpec(buildNotebookScene(makeNotebookSpec())));

    expect(Object.keys(spec.elements).sort()).toEqual(['intro', 'repro']);
    expect(spec.elements.intro).toEqual(markdown('## What we know\n\np99 jumped at 14:02.'));
    expect(spec.elements.repro).toEqual(
      code('promql', 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))')
    );
  });

  it('leaves no cell pointing at a missing element', async () => {
    const spec = specOf(await getSpec(buildNotebookScene(makeNotebookSpec())));

    const referenced = spec.layout.spec.cells.map((c) => c.spec.element.name);
    expect(referenced).toEqual(['intro', 'repro']);
    for (const name of referenced) {
      expect(spec.elements[name]).toBeDefined();
    }
  });

  it('preserves per-cell assistant attribution and cell order', async () => {
    const spec = specOf(await getSpec(buildNotebookScene(makeNotebookSpec())));

    expect(spec.layout.spec.cells.map((c) => c.spec.source)).toEqual(['user', 'assistant']);
  });

  it('returns a NotebookSpec, not the dashboard shape the serializer emits', async () => {
    const spec = specOf(await getSpec(buildNotebookScene(makeNotebookSpec())));

    expect(Object.keys(spec).sort()).toEqual(['description', 'elements', 'layout', 'tags', 'timeSettings', 'title']);
    for (const dashboardOnly of ['variables', 'annotations', 'links', 'cursorSync', 'liveNow', 'preload', 'editable']) {
      expect(spec).not.toHaveProperty(dashboardOnly);
    }
  });

  it('passes notebook validation when asked to validate', async () => {
    const result = await getSpec(buildNotebookScene(makeNotebookSpec()), true);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });
});

describe('APPLY_SPEC on a notebook', () => {
  it('appends an assistant cell to an open notebook', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getSpec(scene));

    const next = {
      ...current,
      elements: { ...current.elements, finding: markdown('The spike correlates with a deploy at 14:00.') },
      layout: {
        kind: 'NotebookLayout',
        spec: { cells: [...current.layout.spec.cells, cell('finding', 'assistant')] },
      },
    };

    const applied = await applySpec(scene, next, true);
    expect(applied.error).toBeUndefined();
    expect(applied.success).toBe(true);

    const after = specOf(await getSpec(scene));
    expect(after.layout.spec.cells.map((c) => c.spec.element.name)).toEqual(['intro', 'repro', 'finding']);
    expect(after.elements.finding).toEqual(markdown('The spike correlates with a deploy at 14:00.'));
    expect(after.layout.spec.cells[2].spec.source).toBe('assistant');
  });

  it('edits an existing cell in place', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getSpec(scene));

    await applySpec(scene, { ...current, elements: { ...current.elements, intro: markdown('## Resolved') } }, true);

    const after = specOf(await getSpec(scene));
    expect(after.elements.intro).toEqual(markdown('## Resolved'));
    expect(Object.keys(after.elements).sort()).toEqual(['intro', 'repro']);
  });

  it('echoes the applied notebook spec so the caller needs no follow-up read', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getSpec(scene));

    const result = await applySpec(scene, { ...current, title: 'Renamed' });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped
    const data = result.data as { applied: boolean; resource: string; spec: NotebookSpec };
    expect(data.applied).toBe(true);
    expect(data.resource).toBe('notebook');
    expect(data.spec.title).toBe('Renamed');
    expect(data.spec).not.toHaveProperty('variables');
  });

  it('keeps the page read-only to hand editing after the rebuild', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getSpec(scene));

    await applySpec(scene, current);

    // The rebuild replaces scene state wholesale; isEmbedded is set by the notebook page, not by
    // the save model, so it has to be carried across or the dashboard edit chrome reappears.
    expect(scene.state.meta.isEmbedded).toBe(true);
    expect(scene.canEditDashboard()).toBe(false);
  });

  it('does not enter dashboard edit mode', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');
    const current = specOf(await getSpec(scene));

    await applySpec(scene, current);

    expect(onEnterEditMode).not.toHaveBeenCalled();
    expect(scene.state.isEditing).toBeFalsy();
  });

  it('restores the document header the rebuild would otherwise blank', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getSpec(scene));

    await applySpec(scene, { ...current, title: 'Renamed', tags: ['resolved'] });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the notebook layout manager holds the header on its own state
    const body = scene.state.body as unknown as { state: { title?: string; tags?: string[] } };
    expect(body.state.title).toBe('Renamed');
    expect(body.state.tags).toEqual(['resolved']);
  });

  describe('validation', () => {
    it('rejects a cell that references a missing element, without mutating', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getSpec(scene));

      const result = await applySpec(
        scene,
        {
          ...current,
          layout: {
            kind: 'NotebookLayout',
            spec: { cells: [...current.layout.spec.cells, cell('ghost', 'assistant')] },
          },
        },
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('no element named "ghost"');
      expect(specOf(await getSpec(scene)).layout.spec.cells).toHaveLength(2);
    });

    it('rejects a dashboard layout with a field-scoped message', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getSpec(scene));

      const result = await applySpec(scene, { ...current, layout: { kind: 'GridLayout', spec: { items: [] } } }, true);

      expect(result.success).toBe(false);
      expect(result.error).toContain('layout');
    });

    it('does not validate when not asked to', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getSpec(scene));

      const result = await applySpec(scene, {
        ...current,
        layout: { kind: 'NotebookLayout', spec: { cells: [...current.layout.spec.cells, cell('ghost', 'assistant')] } },
      });

      // The dangling reference is simply skipped by the deserializer, which is exactly the silent
      // failure mode `validate: true` exists to surface.
      expect(result.success).toBe(true);
      expect(specOf(await getSpec(scene)).layout.spec.cells).toHaveLength(2);
    });
  });
});

/**
 * Panel cells, which the rest of this suite has none of.
 *
 * "Add a chart to my notebook" is the main use case for the surface, and it crosses a seam the
 * narrative cases never touch: a cell's reference is written from the layout manager's own
 * `elementName`, while the matching element key is derived from the serializer's element map. The
 * two agree for whatever was loaded and can disagree for anything added afterwards.
 */
describe('panel cells', () => {
  it('keeps the element name of a panel the notebook was loaded with', async () => {
    const spec = specOf(await getSpec(buildNotebookScene(makeNotebookSpecWithPanel())));

    expect(Object.keys(spec.elements).sort()).toEqual(['intro', 'latency-panel', 'repro']);
    expect(panelIdOf(spec, 'latency-panel')).toBe(1);
    expect(danglingReferences(spec)).toEqual([]);
  });

  it('keeps the element name of a panel added through APPLY_SPEC', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    const current = specOf(await getSpec(scene));

    const result = await applySpec(
      scene,
      {
        ...current,
        elements: { ...current.elements, 'errors-panel': panelElement(3, '5xx rate') },
        layout: {
          kind: 'NotebookLayout',
          spec: { cells: [...current.layout.spec.cells, cell('errors-panel', 'assistant')] },
        },
      },
      true
    );

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const echoed = echoedSpecOf(result);
    expect(Object.keys(echoed.elements).sort()).toEqual(['errors-panel', 'intro', 'latency-panel', 'repro']);
    expect(danglingReferences(echoed)).toEqual([]);
  });

  it('reads back a notebook that still validates after a panel is added', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    const current = specOf(await getSpec(scene));

    await applySpec(
      scene,
      {
        ...current,
        elements: { ...current.elements, 'errors-panel': panelElement(3, '5xx rate') },
        layout: {
          kind: 'NotebookLayout',
          spec: { cells: [...current.layout.spec.cells, cell('errors-panel', 'assistant')] },
        },
      },
      true
    );

    const result = await getSpec(scene, true);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });

  // The round trip a caller actually performs: read, edit, apply, then apply what came back.
  it('keeps a newly added panel when the echoed spec is applied again', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    const current = specOf(await getSpec(scene));

    const applied = await applySpec(scene, {
      ...current,
      elements: { ...current.elements, 'errors-panel': panelElement(3, '5xx rate') },
      layout: {
        kind: 'NotebookLayout',
        spec: { cells: [...current.layout.spec.cells, cell('errors-panel', 'assistant')] },
      },
    });

    await applySpec(scene, echoedSpecOf(applied));

    const after = specOf(await getSpec(scene));
    expect(referencedNames(after)).toEqual(['intro', 'latency-panel', 'repro', 'errors-panel']);
    expect(danglingReferences(after)).toEqual([]);
  });

  it('does not drift when the same spec is applied twice', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    const current = specOf(await getSpec(scene));

    await applySpec(scene, current);
    const afterFirst = specOf(await getSpec(scene));

    await applySpec(scene, afterFirst);
    const afterSecond = specOf(await getSpec(scene));

    expect(afterSecond).toEqual(afterFirst);
  });

  it('keeps the element name of a library panel cell', async () => {
    const spec = specOf(await getSpec(buildNotebookScene(makeNotebookSpecWithLibraryPanel())));

    expect(Object.keys(spec.elements).sort()).toEqual(['intro', 'saved-view']);
    expect(panelIdOf(spec, 'saved-view')).toBe(2);
    expect(danglingReferences(spec)).toEqual([]);
  });
});

describe('APPLY_SPEC permission', () => {
  it('allows a notebook write when the resource is enabled and the user can write dashboards', () => {
    const scene = buildNotebookScene(makeNotebookSpec());

    expect(applySpecCommand.permission(scene)).toEqual({ allowed: true });
  });

  // The whole reason a notebook needs its own rule: the notebook page marks the scene embedded to
  // hide dashboard chrome, which makes canEditDashboard() — and so the dashboard rule — false.
  it('allows it even though the dashboard rule would refuse', () => {
    const scene = buildNotebookScene(makeNotebookSpec());

    expect(scene.canEditDashboard()).toBe(false);
    expect(applySpecCommand.permission(scene).allowed).toBe(true);
  });

  it('refuses when the notebooks feature flag is off', () => {
    notebooksFlagEnabled = false;
    const scene = buildNotebookScene(makeNotebookSpec());

    const result = applySpecCommand.permission(scene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('dashboard.notebooks');
  });

  it('refuses when the user cannot write dashboards', () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action !== AccessControlAction.DashboardsWrite);
    const scene = buildNotebookScene(makeNotebookSpec());

    const result = applySpecCommand.permission(scene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('insufficient permissions');
  });

  it('refuses on a notebook snapshot', () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    scene.setState({ meta: { ...scene.state.meta, isSnapshot: true } });

    expect(applySpecCommand.permission(scene).allowed).toBe(false);
  });

  it('still applies the dashboard rule to a dashboard', () => {
    const dashboardNewLayouts = config.featureToggles.dashboardNewLayouts;
    config.featureToggles.dashboardNewLayouts = false;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the layout descriptor and meta are read
    const dashboardScene = {
      state: { body: { descriptor: { id: 'GridLayout' } }, meta: {} },
      canEditDashboard: () => true,
    } as unknown as DashboardScene;

    const result = applySpecCommand.permission(dashboardScene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('dashboardNewLayouts');

    config.featureToggles.dashboardNewLayouts = dashboardNewLayouts;
  });
});
