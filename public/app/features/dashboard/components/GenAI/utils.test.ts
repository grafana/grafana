import { createDashboardModelFixture, createPanelSaveModel } from '../../state/__fixtures__/dashboardFixtures';

import { openai } from './llms';
import { getDashboardChanges, isLLMPluginEnabled, sanitizeReply } from './utils';

// Mock the llms.openai module
jest.mock('./llms', () => ({
  openai: {
    streamChatCompletions: jest.fn(),
    accumulateContent: jest.fn(),
    enabled: jest.fn(),
  },
}));

describe('getDashboardChanges', () => {
  it('should correctly split user changes and migration changes', () => {
    // Mock data for testing
    const deprecatedOptions = {
      legend: { displayMode: 'hidden', showLegend: false },
    };
    const deprecatedVersion = 37;
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
    expect(result.userChanges).toEqual({
      panels: [
        {
          op: 'replace',
          originalValue: 'Panel 1',
          value: 'New title',
          startLineNumber: expect.any(Number),
          path: ['panels', '0', 'title'],
        },
      ],
    });
    expect(result.migrationChanges).toBeDefined();
    expect(result.userChanges).not.toContain({
      panels: [
        {
          op: 'replace',
          originalValue: 'Panel 1',
          value: 'New title',
          startLineNumber: expect.any(Number),
          path: ['panels', '0', 'title'],
        },
      ],
    });
  });
});

describe('isLLMPluginEnabled', () => {
  it('should return true if LLM plugin is enabled', async () => {
    // Mock llms.openai.enabled to return true
    jest.mocked(openai.enabled).mockResolvedValue(true);

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(true);
  });

  it('should return false if LLM plugin is not enabled', async () => {
    // Mock llms.openai.enabled to return false
    jest.mocked(openai.enabled).mockResolvedValue(false);

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
