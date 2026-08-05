/**
 * GET_NOTEBOOK_SPEC: what a read of an open notebook returns.
 *
 * A real notebook scene, built the way the notebook page builds one, through the real handler and the
 * real serializer. Unmocked on purpose: the bug this command exists to fix lived in the seam between
 * those pieces, where `elements` came from viz panels alone and every narrative cell disappeared.
 */

import { contextSrv } from 'app/core/services/context_srv';

import { type DashboardScene } from '../../scene/DashboardScene';

import { applyNotebookSpecCommand } from './applyNotebookSpec';
import { getNotebookSpecCommand } from './getNotebookSpec';
import {
  buildNotebookScene,
  code,
  contextFor,
  danglingReferences,
  makeNotebookSpec,
  makeNotebookSpecWithLibraryPanel,
  makeNotebookSpecWithPanel,
  markdown,
  panelIdOf,
  referencedNames,
  specOf,
  stubDashboardScene,
} from './test-utils';

let notebooksFlagEnabled = true;

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => notebooksFlagEnabled }),
}));

async function getNotebookSpec(scene: DashboardScene, validate = false) {
  return getNotebookSpecCommand.handler({ validate }, contextFor(scene));
}

beforeEach(() => {
  notebooksFlagEnabled = true;
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET_NOTEBOOK_SPEC', () => {
  it('returns the open notebook', async () => {
    const result = await getNotebookSpec(buildNotebookScene(makeNotebookSpec()));

    expect(result.success).toBe(true);
    expect(specOf(result).title).toBe('Checkout latency investigation');
  });

  // The regression this whole change exists for: elements used to be derived from getVizPanels(),
  // so every markdown and code cell vanished while the layout kept referencing it by name.
  it('keeps narrative cells instead of dropping them', async () => {
    const spec = specOf(await getNotebookSpec(buildNotebookScene(makeNotebookSpec())));

    expect(Object.keys(spec.elements).sort()).toEqual(['intro', 'repro']);
    expect(spec.elements.intro).toEqual(markdown('## What we know\n\np99 jumped at 14:02.'));
    expect(spec.elements.repro).toEqual(
      code('promql', 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))')
    );
  });

  it('leaves no cell pointing at a missing element', async () => {
    const spec = specOf(await getNotebookSpec(buildNotebookScene(makeNotebookSpec())));

    const referenced = spec.layout.spec.cells.map((c) => c.spec.element.name);
    expect(referenced).toEqual(['intro', 'repro']);
    for (const name of referenced) {
      expect(spec.elements[name]).toBeDefined();
    }
  });

  it('preserves per-cell assistant attribution and cell order', async () => {
    const spec = specOf(await getNotebookSpec(buildNotebookScene(makeNotebookSpec())));

    expect(spec.layout.spec.cells.map((c) => c.spec.source)).toEqual(['user', 'assistant']);
  });

  it('returns a NotebookSpec, not the dashboard shape the serializer emits', async () => {
    const spec = specOf(await getNotebookSpec(buildNotebookScene(makeNotebookSpec())));

    expect(Object.keys(spec).sort()).toEqual(['description', 'elements', 'layout', 'tags', 'timeSettings', 'title']);
    for (const dashboardOnly of ['variables', 'annotations', 'links', 'cursorSync', 'liveNow', 'preload', 'editable']) {
      expect(spec).not.toHaveProperty(dashboardOnly);
    }
  });

  it('passes notebook validation when asked to validate', async () => {
    const result = await getNotebookSpec(buildNotebookScene(makeNotebookSpec()), true);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });
});

/**
 * Panel cells, which the cases above have none of.
 *
 * "Add a chart to my notebook" is the main use case for the surface, and a panel crosses a seam a
 * narrative cell never touches: its element key comes from the serializer's element map while the
 * cell's reference comes from the layout manager's own `elementName`.
 */
describe('GET_NOTEBOOK_SPEC on panel cells', () => {
  it('keeps the element name of a panel the notebook was loaded with', async () => {
    const spec = specOf(await getNotebookSpec(buildNotebookScene(makeNotebookSpecWithPanel())));

    expect(Object.keys(spec.elements).sort()).toEqual(['intro', 'latency-panel', 'repro']);
    expect(panelIdOf(spec, 'latency-panel')).toBe(1);
    expect(danglingReferences(spec)).toEqual([]);
  });

  it('keeps the element name of a library panel cell', async () => {
    const spec = specOf(await getNotebookSpec(buildNotebookScene(makeNotebookSpecWithLibraryPanel())));

    expect(Object.keys(spec.elements).sort()).toEqual(['intro', 'saved-view']);
    expect(panelIdOf(spec, 'saved-view')).toBe(2);
    expect(danglingReferences(spec)).toEqual([]);
  });

  // The invariant the rename above is a consequence of: whatever the elements map ends up keyed by, a
  // cell points at a key that is in it. Pinned by clearing the serializer's element map, which is what
  // a name it does not know looks like from here, and is how a panel cell used to disappear: the
  // elements side fell back to `panel-<id>` while the layout kept the name it was loaded with.
  it('resolves a panel cell even when the serializer cannot name its panel', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    scene.serializer.initializeElementMapping(undefined);

    const spec = specOf(await getNotebookSpec(scene));

    expect(danglingReferences(spec)).toEqual([]);
    expect(referencedNames(spec)).toEqual(['intro', 'panel-1', 'repro']);
  });
});

describe('GET_NOTEBOOK_SPEC permission', () => {
  // Reading a notebook needs its own rule rather than the unconditional one GET_SPEC uses, because
  // the command promises a notebook spec and a dashboard cannot produce one.
  it('allows a read of an embedded notebook', () => {
    const scene = buildNotebookScene(makeNotebookSpec());

    expect(scene.canEditDashboard()).toBe(false);
    expect(getNotebookSpecCommand.permission(scene)).toEqual({ allowed: true });
  });

  it('refuses a dashboard', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the layout descriptor is read
    const dashboardScene = { state: { body: { descriptor: { id: 'GridLayout' } } } } as unknown as DashboardScene;

    const result = getNotebookSpecCommand.permission(dashboardScene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('notebooks only');
  });

  it('refuses when the notebooks feature flag is off', () => {
    notebooksFlagEnabled = false;
    const scene = buildNotebookScene(makeNotebookSpec());

    const result = getNotebookSpecCommand.permission(scene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('dashboard.notebooks');
  });

  // Allowed on purpose, and the opposite of the write rule. A snapshot is not readable-or-not, it is
  // editable-or-not: no other read command gates on it, GET_SPEC included, so refusing here would
  // invent a restriction the surface does not have.
  it('allows a read of a notebook snapshot', () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    scene.setState({ meta: { ...scene.state.meta, isSnapshot: true } });

    expect(getNotebookSpecCommand.permission(scene)).toEqual({ allowed: true });
    expect(applyNotebookSpecCommand.permission(scene).allowed).toBe(false);
  });
});
