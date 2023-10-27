import { llms } from '@grafana/experimental';

import { isLLMPluginEnabled } from './helpers';

// Mock the grafana-experimental llms module
jest.mock('@grafana/experimental', () => ({
  llms: {
    openai: {
      enabled: jest.fn(),
    },
    vector: {
      enabled: jest.fn(),
    },
  },
}));

describe('isLLMPluginEnabled', () => {
  it('should return true if LLM plugin is enabled', async () => {
    jest.mocked(llms.openai.enabled).mockResolvedValue({ ok: true, configured: true });
    jest.mocked(llms.vector.enabled).mockResolvedValue({ ok: true, enabled: true });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(true);
  });

  it('should return false if LLM plugin is not enabled', async () => {
    jest.mocked(llms.openai.enabled).mockResolvedValue({ ok: false, configured: false });
    jest.mocked(llms.vector.enabled).mockResolvedValue({ ok: false, enabled: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });

  it('should return false if LLM plugin is enabled but health check fails', async () => {
    jest.mocked(llms.openai.enabled).mockResolvedValue({ ok: false, configured: true });
    jest.mocked(llms.vector.enabled).mockResolvedValue({ ok: false, enabled: true });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });
});
