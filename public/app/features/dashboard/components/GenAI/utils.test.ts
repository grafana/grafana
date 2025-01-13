import { llms } from '@grafana/experimental';

import { DASHBOARD_SCHEMA_VERSION } from '../../state/DashboardMigrator';
import { createDashboardModelFixture, createPanelSaveModel } from '../../state/__fixtures__/dashboardFixtures';
import { NEW_PANEL_TITLE } from '../../utils/dashboard';

import { getDashboardChanges, getPanelStrings, isLLMPluginEnabled, sanitizeReply } from './utils';

// Mock the llms.openai module
jest.mock('@grafana/experimental', () => ({
  ...jest.requireActual('@grafana/experimental'),
  llms: {
    openai: {
      streamChatCompletions: jest.fn(),
      accumulateContent: jest.fn(),
      health: jest.fn(),
    },
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    apps: {
      'grafana-llm-app': true,
    },
  },
}));

describe('getDashboardChanges', () => {
  it('should correctly split user changes and migration changes', () => {
    // Mock data for testing
    const deprecatedOptions = {
      legend: { displayMode: 'hidden', showLegend: false },
    };
    const deprecatedVersion = DASHBOARD_SCHEMA_VERSION - 1;
    const dashboard = createDashboardModelFixture({
      schemaVersion: deprecatedVersion,
      panels: [createPanelSaveModel({ title: 'Panel 1', options: deprecatedOptions })],
    });

    // Update title for the first panel
    dashboard.updatePanels([
      {
        ...dashboard.panels[0],
        title: 'New title',
      },
      ...dashboard.panels.slice(1),
    ]);

    // Call the function to test
    const result = getDashboardChanges(dashboard);

    // Assertions
    expect(result.migrationChanges).toContain(
      `-  "schemaVersion": ${deprecatedVersion},\n+  "schemaVersion": ${DASHBOARD_SCHEMA_VERSION},\n`
    );

    expect(result.migrationChanges).not.toContain(
      '   "panels": [\n' +
        '     {\n' +
        '-      "type": "timeseries",\n' +
        '-      "title": "Panel 1",\n' +
        '+      "id": 1,\n'
    );

    expect(result.migrationChanges).not.toContain(
      '-      }\n' +
        '+      },\n' +
        '+      "title": "New title",\n' +
        '+      "type": "timeseries"\n' +
        '     }\n' +
        '   ]\n' +
        ' }\n'
    );

    expect(result.userChanges).not.toContain('-  "schemaVersion": 37,\n' + '+  "schemaVersion": 38,\n');

    expect(result.userChanges).toContain(
      '   "panels": [\n' +
        '     {\n' +
        '-      "type": "timeseries",\n' +
        '-      "title": "Panel 1",\n' +
        '+      "id": 1,\n'
    );

    expect(result.userChanges).toContain(
      '-      }\n' +
        '+      },\n' +
        '+      "title": "New title",\n' +
        '+      "type": "timeseries"\n' +
        '     }\n' +
        '   ]\n' +
        ' }\n'
    );

    expect(result.migrationChanges).toBeDefined();
  });
});

describe('isLLMPluginEnabled', () => {
  it('should return false if LLM plugin is not enabled', async () => {
    // Mock llms.openai.health to return false
    jest.mocked(llms.openai.health).mockResolvedValue({ ok: false, configured: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });

  it('should return true if LLM plugin is enabled', async () => {
    // Mock llms.openai.health to return true
    jest.mocked(llms.openai.health).mockResolvedValue({ ok: true, configured: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(true);
  });
});

describe('sanitizeReply', () => {
  it('should remove quotes from the beginning and end of a string', () => {
    expect(sanitizeReply('"Hello, world!"')).toBe('Hello, world!');
  });

  it('should not remove quotes from the middle of a string', () => {
    expect(sanitizeReply('Hello, "world"!')).toBe('Hello, "world"!');
  });

  it('should only remove quotes if they are at the beginning or end of a string, and not in the middle', () => {
    expect(sanitizeReply('"Hello", world!')).toBe('Hello", world!');
  });

  it('should return an empty string if given an empty string', () => {
    expect(sanitizeReply('')).toBe('');
  });
});

describe('getPanelStrings', () => {
  function dashboardSetup(items: Array<{ title: string; description: string }>) {
    return createDashboardModelFixture({
      panels: items.map((item) => createPanelSaveModel(item)),
    });
  }

  it('should return an empty array if all panels dont have title or descriptions', () => {
    const dashboard = dashboardSetup([{ title: '', description: '' }]);

    expect(getPanelStrings(dashboard)).toEqual([]);
  });

  it('should return an empty array if all panels have no description and panels that have title are titled "Panel title', () => {
    const dashboard = dashboardSetup([{ title: NEW_PANEL_TITLE, description: '' }]);

    expect(getPanelStrings(dashboard)).toEqual([]);
  });

  it('should return an array of panels if a panel has a title or description', () => {
    const dashboard = dashboardSetup([
      { title: 'Graph panel', description: '' },
      { title: '', description: 'Logs' },
    ]);

    expect(getPanelStrings(dashboard)).toEqual([
      '- Panel 0\n- Title: Graph panel',
      '- Panel 1\n- Title: \n- Description: Logs',
    ]);
  });

  it('returns an array with title and description if both are present', () => {
    const dashboard = dashboardSetup([
      { title: 'Graph panel', description: 'Logs' },
      { title: 'Table panel', description: 'Metrics' },
    ]);

    expect(getPanelStrings(dashboard)).toEqual([
      '- Panel 0\n- Title: Graph panel\n- Description: Logs',
      '- Panel 1\n- Title: Table panel\n- Description: Metrics',
    ]);
  });
});
