import { loadSandboxMermaid, loadSandboxRuntime } from './loadSandboxRuntime';

const mockMermaidModule = jest.fn(() => ({ __esModule: true, default: 'trusted Mermaid source' }));
jest.mock('./sandboxRuntime?text-panel-runtime', () => ({ __esModule: true, default: 'base source' }), {
  virtual: true,
});
jest.mock('./sandboxMermaid?text-panel-runtime', () => mockMermaidModule(), { virtual: true });

it('loads the base independently and shares one Mermaid bundle across concurrent panels', async () => {
  expect(await loadSandboxRuntime()).toBe('base source');
  expect(mockMermaidModule).not.toHaveBeenCalled();
  const first = loadSandboxMermaid();
  const second = loadSandboxMermaid();
  expect(first).toBe(second);
  expect(await first).toBe('trusted Mermaid source');
  expect(await loadSandboxMermaid()).toBe('trusted Mermaid source');
  expect(mockMermaidModule).toHaveBeenCalledTimes(1);
});

it('allows a later panel to retry a failed Mermaid bundle load', async () => {
  jest.resetModules();
  mockMermaidModule.mockClear();
  mockMermaidModule.mockImplementationOnce(() => {
    throw new Error('Chunk unavailable');
  });
  const { loadSandboxMermaid } = await import('./loadSandboxRuntime');
  await expect(loadSandboxMermaid()).rejects.toThrow('Chunk unavailable');
  expect(await loadSandboxMermaid()).toBe('trusted Mermaid source');
  expect(mockMermaidModule).toHaveBeenCalledTimes(2);
});
