import { type AppPluginConfig } from '@grafana/data';
import { llm } from '@grafana/llm';
import { setAppPluginMetas } from '@grafana/runtime/internal';

import { createDashboardModelFixture, createPanelSaveModel } from '../../state/__fixtures__/dashboardFixtures';
import { NEW_PANEL_TITLE } from '../../utils/dashboard';

import { getPanelStrings, isLLMPluginEnabled, sanitizeReply } from './utils';

// Mock the llm module
jest.mock('@grafana/llm', () => ({
  ...jest.requireActual('@grafana/llm'),
  llm: {
    streamChatCompletions: jest.fn(),
    accumulateContent: jest.fn(),
    health: jest.fn(),
    Model: { LARGE: 'large' },
  },
}));

describe('isLLMPluginEnabled', () => {
  beforeEach(() => {
    setAppPluginMetas({ 'grafana-llm-app': {} as AppPluginConfig });
  });

  it('should return false if LLM plugin is not enabled', async () => {
    // Mock llm.health to return false
    jest.mocked(llm.health).mockResolvedValue({ ok: false, configured: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });

  it('should return true if LLM plugin is enabled', async () => {
    // Mock llm.health to return true
    jest.mocked(llm.health).mockResolvedValue({ ok: true, configured: false });

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
