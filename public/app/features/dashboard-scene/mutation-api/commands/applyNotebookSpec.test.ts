/**
 * APPLY_NOTEBOOK_SPEC: what a whole-spec write does to an open notebook.
 *
 * Reads through GET_NOTEBOOK_SPEC to set up and to check, because that is the round trip a caller
 * performs: read, edit the JSON, apply, and later apply what came back.
 */

import { config } from '@grafana/runtime';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { type DashboardScene } from '../../scene/DashboardScene';

import { applyNotebookSpecCommand } from './applyNotebookSpec';
import { getNotebookSpecCommand } from './getNotebookSpec';
import {
  buildNotebookScene,
  cell,
  contextFor,
  danglingReferences,
  echoedSpecOf,
  makeNotebookSpec,
  makeNotebookSpecWithPanel,
  markdown,
  panelElement,
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

async function applyNotebookSpec(scene: DashboardScene, spec: unknown, validate = false) {
  return applyNotebookSpecCommand.handler({ spec: spec as Record<string, unknown>, validate }, contextFor(scene));
}

beforeEach(() => {
  notebooksFlagEnabled = true;
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('APPLY_NOTEBOOK_SPEC', () => {
  it('appends an assistant cell to an open notebook', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getNotebookSpec(scene));

    const next = {
      ...current,
      elements: { ...current.elements, finding: markdown('The spike correlates with a deploy at 14:00.') },
      layout: {
        kind: 'NotebookLayout',
        spec: { cells: [...current.layout.spec.cells, cell('finding', 'assistant')] },
      },
    };

    const applied = await applyNotebookSpec(scene, next, true);
    expect(applied.error).toBeUndefined();
    expect(applied.success).toBe(true);

    const after = specOf(await getNotebookSpec(scene));
    expect(after.layout.spec.cells.map((c) => c.spec.element.name)).toEqual(['intro', 'repro', 'finding']);
    expect(after.elements.finding).toEqual(markdown('The spike correlates with a deploy at 14:00.'));
    expect(after.layout.spec.cells[2].spec.source).toBe('assistant');
  });

  it('edits an existing cell in place', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getNotebookSpec(scene));

    await applyNotebookSpec(
      scene,
      { ...current, elements: { ...current.elements, intro: markdown('## Resolved') } },
      true
    );

    const after = specOf(await getNotebookSpec(scene));
    expect(after.elements.intro).toEqual(markdown('## Resolved'));
    expect(Object.keys(after.elements).sort()).toEqual(['intro', 'repro']);
  });

  it('echoes the applied notebook spec so the caller needs no follow-up read', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getNotebookSpec(scene));

    const result = await applyNotebookSpec(scene, { ...current, title: 'Renamed' });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped
    const data = result.data as { applied: boolean; spec: NotebookSpec };
    expect(data.applied).toBe(true);
    expect(data.spec.title).toBe('Renamed');
    expect(data.spec).not.toHaveProperty('variables');
  });

  it('keeps the page read-only to hand editing after the rebuild', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getNotebookSpec(scene));

    await applyNotebookSpec(scene, current);

    // The rebuild replaces scene state wholesale; isEmbedded is set by the notebook page, not by
    // the save model, so it has to be carried across or the dashboard edit chrome reappears.
    expect(scene.state.meta.isEmbedded).toBe(true);
    expect(scene.canEditDashboard()).toBe(false);
  });

  it('does not enter dashboard edit mode', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');
    const current = specOf(await getNotebookSpec(scene));

    await applyNotebookSpec(scene, current);

    expect(onEnterEditMode).not.toHaveBeenCalled();
    expect(scene.state.isEditing).toBeFalsy();
  });

  it('restores the document header the rebuild would otherwise blank', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const current = specOf(await getNotebookSpec(scene));

    await applyNotebookSpec(scene, { ...current, title: 'Renamed', tags: ['resolved'] });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the notebook layout manager holds the header on its own state
    const body = scene.state.body as unknown as { state: { title?: string; tags?: string[] } };
    expect(body.state.title).toBe('Renamed');
    expect(body.state.tags).toEqual(['resolved']);
  });

  describe('validation', () => {
    it('rejects a cell that references a missing element, without mutating', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getNotebookSpec(scene));

      const result = await applyNotebookSpec(
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
      expect(specOf(await getNotebookSpec(scene)).layout.spec.cells).toHaveLength(2);
    });

    it('rejects a dashboard layout with a field-scoped message', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getNotebookSpec(scene));

      const result = await applyNotebookSpec(
        scene,
        { ...current, layout: { kind: 'GridLayout', spec: { items: [] } } },
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('layout');
    });

    it('does not validate when not asked to', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getNotebookSpec(scene));

      const result = await applyNotebookSpec(scene, {
        ...current,
        layout: { kind: 'NotebookLayout', spec: { cells: [...current.layout.spec.cells, cell('ghost', 'assistant')] } },
      });

      // The dangling reference is simply skipped by the deserializer, which is exactly the silent
      // failure mode `validate: true` exists to surface.
      expect(result.success).toBe(true);
      expect(specOf(await getNotebookSpec(scene)).layout.spec.cells).toHaveLength(2);
    });

    // A write can lose a cell and still succeed, and `validate` cannot be the whole answer because it
    // judges the request, not what the scene did with it. So the result names what did not survive.
    it('warns about a cell that did not survive the write', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getNotebookSpec(scene));

      const result = await applyNotebookSpec(scene, {
        ...current,
        layout: { kind: 'NotebookLayout', spec: { cells: [...current.layout.spec.cells, cell('ghost', 'assistant')] } },
      });

      expect(result.success).toBe(true);
      expect(result.warnings?.join(' ')).toContain('ghost');
    });

    it('reports no warnings when every cell landed', async () => {
      const scene = buildNotebookScene(makeNotebookSpec());
      const current = specOf(await getNotebookSpec(scene));

      const result = await applyNotebookSpec(scene, {
        ...current,
        elements: { ...current.elements, finding: markdown('Deploy at 14:00 lines up with the spike.') },
        layout: {
          kind: 'NotebookLayout',
          spec: { cells: [...current.layout.spec.cells, cell('finding', 'assistant')] },
        },
      });

      expect(result.warnings).toBeUndefined();
    });
  });
});

// The panel-cell cases that write. A panel added by an apply is where the element key and the cell's
// own reference can disagree: they agree for whatever was loaded, and nothing forces it afterwards.
describe('APPLY_NOTEBOOK_SPEC on panel cells', () => {
  it('keeps the element name of a panel added through APPLY_NOTEBOOK_SPEC', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    const current = specOf(await getNotebookSpec(scene));

    const result = await applyNotebookSpec(
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
    const current = specOf(await getNotebookSpec(scene));

    await applyNotebookSpec(
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

    const result = await getNotebookSpec(scene, true);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });

  // The round trip a caller actually performs: read, edit, apply, then apply what came back.
  it('keeps a newly added panel when the echoed spec is applied again', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    const current = specOf(await getNotebookSpec(scene));

    const applied = await applyNotebookSpec(scene, {
      ...current,
      elements: { ...current.elements, 'errors-panel': panelElement(3, '5xx rate') },
      layout: {
        kind: 'NotebookLayout',
        spec: { cells: [...current.layout.spec.cells, cell('errors-panel', 'assistant')] },
      },
    });

    await applyNotebookSpec(scene, echoedSpecOf(applied));

    const after = specOf(await getNotebookSpec(scene));
    expect(referencedNames(after)).toEqual(['intro', 'latency-panel', 'repro', 'errors-panel']);
    expect(danglingReferences(after)).toEqual([]);
  });

  it('does not drift when the same spec is applied twice', async () => {
    const scene = buildNotebookScene(makeNotebookSpecWithPanel());
    const current = specOf(await getNotebookSpec(scene));

    await applyNotebookSpec(scene, current);
    const afterFirst = specOf(await getNotebookSpec(scene));

    await applyNotebookSpec(scene, afterFirst);
    const afterSecond = specOf(await getNotebookSpec(scene));

    expect(afterSecond).toEqual(afterFirst);
  });
});

describe('APPLY_NOTEBOOK_SPEC permission', () => {
  it('allows a write to an embedded notebook, which the dashboard rule would refuse', () => {
    const scene = buildNotebookScene(makeNotebookSpec());

    expect(scene.canEditDashboard()).toBe(false);
    expect(applyNotebookSpecCommand.permission(scene)).toEqual({ allowed: true });
  });

  it('refuses a dashboard', () => {
    const dashboardScene = stubDashboardScene();

    const result = applyNotebookSpecCommand.permission(dashboardScene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('notebooks only');
  });

  it('refuses when the notebooks feature flag is off', () => {
    notebooksFlagEnabled = false;
    const scene = buildNotebookScene(makeNotebookSpec());

    const result = applyNotebookSpecCommand.permission(scene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('dashboard.notebooks');
  });

  it('refuses on a notebook snapshot', () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    scene.setState({ meta: { ...scene.state.meta, isSnapshot: true } });

    const result = applyNotebookSpecCommand.permission(scene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('snapshot');
  });

  it('refuses when the user cannot write dashboards', () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action !== AccessControlAction.DashboardsWrite);
    const scene = buildNotebookScene(makeNotebookSpec());

    const result = applyNotebookSpecCommand.permission(scene);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.error).toContain('insufficient permissions');
  });

  // A notebook layout is not one of the new dashboard layouts, so the toggle that gates those says
  // nothing about it. Pinned because the obvious tidy-up is to reuse the dashboard rule, which would
  // make every notebook write depend on a toggle no notebook reads.
  it('does not depend on the dashboardNewLayouts toggle', () => {
    const dashboardNewLayouts = config.featureToggles.dashboardNewLayouts;
    config.featureToggles.dashboardNewLayouts = false;
    const scene = buildNotebookScene(makeNotebookSpec());

    expect(applyNotebookSpecCommand.permission(scene)).toEqual({ allowed: true });

    config.featureToggles.dashboardNewLayouts = dashboardNewLayouts;
  });
});
