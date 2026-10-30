import { FieldType, getPanelDataSummary, toDataFrame } from '@grafana/data';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({
    getBooleanValue: (flag: string) => (flag === 'text.newFeatures' ? mockNewFeatures : mockNewTextPanel),
  }),
}));

let mockNewTextPanel = false;
let mockNewFeatures = false;

// module.tsx picks the version at import time, so each case needs a fresh module registry.
// The comparison has to happen inside it too: an isolated registry re-evaluates the version
// modules, so components imported outside it would not be the same object.
async function rendersPanel(newTextPanel: boolean, versionModule: string, exportName: string) {
  mockNewTextPanel = newTextPanel;
  mockNewFeatures = newTextPanel;
  let matches = false;
  await jest.isolateModulesAsync(async () => {
    const { plugin } = await import('./module');
    const version = await import(versionModule);
    matches = plugin.panel === version[exportName];
  });
  return matches;
}

async function suggestionNames(newTextPanel: boolean, newFeatures: boolean) {
  mockNewTextPanel = newTextPanel;
  mockNewFeatures = newFeatures;
  const summary = getPanelDataSummary([
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'CPU', type: FieldType.number, values: [40, 75] },
      ],
    }),
  ]);
  let names: string[] = [];
  await jest.isolateModulesAsync(async () => {
    const { plugin } = await import('./module');
    names = plugin.getSuggestions(summary)?.map(({ name }) => name) ?? [];
  });
  return names;
}

describe('text module', () => {
  it('uses the v1 panel when grafana.newTextPanel is off', async () => {
    expect(await rendersPanel(false, './v1/TextPanel', 'TextPanel')).toBe(true);
  });

  it('uses the v2 panel when grafana.newTextPanel is on', async () => {
    expect(await rendersPanel(true, './v2/TextNGPanel', 'TextNGPanel')).toBe(true);
  });

  it.each([
    { newTextPanel: false, newFeatures: true, expected: [] },
    { newTextPanel: true, newFeatures: false, expected: [] },
    { newTextPanel: true, newFeatures: true, expected: ['Text - summary', 'Text - statistics'] },
  ])(
    'suggests $expected for query data with grafana.newTextPanel $newTextPanel and text.newFeatures $newFeatures',
    async ({ newTextPanel, newFeatures, expected }) => {
      expect(await suggestionNames(newTextPanel, newFeatures)).toEqual(expected);
    }
  );
});
