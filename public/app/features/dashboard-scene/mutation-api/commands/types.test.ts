import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardMutationClient } from '../DashboardMutationClient';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

let cleanUpPreviousScene = () => {};

function setup() {
  cleanUpPreviousScene();
  const scene = new DashboardScene({ title: 'hello', meta: { canEdit: true } });
  cleanUpPreviousScene = scene.activate();
  const client = new DashboardMutationClient(scene);
  return { scene, client };
}

afterEach(() => {
  cleanUpPreviousScene();
  cleanUpPreviousScene = () => {};
  setTestFlags({});
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
});

describe('requiresEdit, blocked on mobile', () => {
  it('rejects ENTER_EDIT_MODE with a descriptive error and does not enter edit mode', async () => {
    setTestFlags({ 'grafana.mobileEditDeprecation': true });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { scene, client } = setup();

    const result = await client.execute({ type: 'ENTER_EDIT_MODE', payload: {} });

    expect(result).toEqual({
      success: false,
      error:
        'Dashboard editing is not available on small screens. Tell the user to switch to a larger screen ' +
        '(tablet or desktop) to build or edit dashboards, and do not retry this action.',
      changes: [],
    });
    expect(scene.state.isEditing).toBeFalsy();
  });

  it('still allows ENTER_EDIT_MODE when the toggle is on but the viewport is not mobile-sized', async () => {
    setTestFlags({ 'grafana.mobileEditDeprecation': true });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
    const { scene, client } = setup();

    const result = await client.execute({ type: 'ENTER_EDIT_MODE', payload: {} });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBe(true);
  });

  it('still allows ENTER_EDIT_MODE on a mobile-sized viewport when the toggle is off', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { scene, client } = setup();

    const result = await client.execute({ type: 'ENTER_EDIT_MODE', payload: {} });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBe(true);
  });
});
