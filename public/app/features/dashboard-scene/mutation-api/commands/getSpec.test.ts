/**
 * GET_SPEC: reading a whole dashboard, and refusing anything that is not one.
 */

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardMutationClient } from '../DashboardMutationClient';

import { getSpecCommand } from './getSpec';
import {
  buildDashboardScene,
  buildNotebookScene,
  contextFor,
  dashboardDanglingReferences,
  makeDashboardSpec,
  makeNotebookSpec,
  stubDashboardScene,
} from './test-utils';

let notebooksFlagEnabled = true;

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => notebooksFlagEnabled }),
}));

async function getSpec(scene: DashboardScene, validate = false) {
  return getSpecCommand.handler({ validate }, contextFor(scene));
}

function specOf(result: Awaited<ReturnType<typeof getSpec>>): DashboardV2Spec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: DashboardV2Spec }).spec;
}

function clientFor(scene: DashboardScene) {
  return new DashboardMutationClient(scene);
}

describe('GET_SPEC on a dashboard', () => {
  it('keeps the element name the dashboard was loaded with', async () => {
    const spec = specOf(await getSpec(buildDashboardScene(makeDashboardSpec())));

    expect(Object.keys(spec.elements)).toEqual(['latency-panel']);
    expect(dashboardDanglingReferences(spec)).toEqual([]);
  });
});

/**
 * The other half of the contract: asked of a notebook, this command refuses.
 *
 * Driven through the client rather than the handler, because the refusal lives in the permission rule
 * and the client is what runs it. That is also why it is worth a case: a handler reached on the wrong
 * resource does not fail loudly. It would serialize the notebook through the dashboard serializer and
 * hand back a spec with every narrative cell missing.
 */
describe('GET_SPEC on a notebook', () => {
  it('GET_SPEC refuses, and says which command to use instead', async () => {
    const result = await clientFor(buildNotebookScene(makeNotebookSpec())).execute({
      type: 'GET_SPEC',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('dashboards only');
    expect(result.error).toContain('GET_NOTEBOOK_SPEC');
  });

  it('still answers on a dashboard', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the layout descriptor is read
    const dashboardScene = { state: { body: { descriptor: { id: 'GridLayout' } } } } as unknown as DashboardScene;

    expect(getSpecCommand.permission(dashboardScene)).toEqual({ allowed: true });
  });
});
