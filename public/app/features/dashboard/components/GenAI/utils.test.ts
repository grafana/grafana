import { llms } from '@grafana/experimental';

import { DASHBOARD_SCHEMA_VERSION } from '../../state/DashboardMigrator';
import { createDashboardModelFixture, createPanelSaveModel } from '../../state/__fixtures__/dashboardFixtures';

import { getDashboardChanges, isLLMPluginEnabled, sanitizeReply } from './utils';

// Mock the llms.openai module
jest.mock('@grafana/experimental', () => ({
  llms: {
    openai: {
      streamChatCompletions: jest.fn(),
      accumulateContent: jest.fn(),
      health: jest.fn(),
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
  it('should return true if LLM plugin is enabled', async () => {
    // Mock llms.openai.health to return true
    jest.mocked(llms.openai.health).mockResolvedValue({ ok: true, configured: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(true);
  });

  it('should return false if LLM plugin is not enabled', async () => {
    // Mock llms.openai.health to return false
    jest.mocked(llms.openai.health).mockResolvedValue({ ok: false, configured: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
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
