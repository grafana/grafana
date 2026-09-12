jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => mockNewTextPanel }),
}));

let mockNewTextPanel = false;

// module.tsx picks the version at import time, so each case needs a fresh module registry.
// The comparison has to happen inside it too: an isolated registry re-evaluates the version
// modules, so components imported outside it would not be the same object.
async function rendersPanel(newTextPanel: boolean, versionModule: string, exportName: string) {
  mockNewTextPanel = newTextPanel;
  let matches = false;
  await jest.isolateModulesAsync(async () => {
    const { plugin } = await import('./module');
    const version = await import(versionModule);
    matches = plugin.panel === version[exportName];
  });
  return matches;
}

describe('text module', () => {
  it('uses the v1 panel when grafana.newTextPanel is off', async () => {
    expect(await rendersPanel(false, './v1/TextPanel', 'TextPanel')).toBe(true);
  });

  it('uses the v2 panel when grafana.newTextPanel is on', async () => {
    expect(await rendersPanel(true, './v2/TextNGPanel', 'TextNGPanel')).toBe(true);
  });
});
