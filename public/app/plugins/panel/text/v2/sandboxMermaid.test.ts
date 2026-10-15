import mermaid from 'mermaid';

import type { RenderDiagrams } from './sandboxMermaid';
import { TEXT_FRAME_PROTOCOL, type RenderCommand } from './sandboxProtocol';

jest.mock('mermaid', () => ({ initialize: jest.fn(), render: jest.fn() }));

const command: RenderCommand = {
  protocol: TEXT_FRAME_PROTOCOL,
  channel: 'test',
  type: 'render',
  html: '',
  globalCss: '',
  diagramError: 'Diagram failed',
  mermaid: { securityLevel: 'loose', htmlLabels: true, flowchart: { htmlLabels: true } },
};

describe('sandbox Mermaid runtime', () => {
  let render: RenderDiagrams;
  let container: HTMLDivElement;

  beforeEach(() => {
    const script = Object.assign(document.createElement('script'), {
      registerMermaid: (renderer: RenderDiagrams) => {
        render = renderer;
      },
    });
    jest.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    jest.isolateModules(() => require('./sandboxMermaid'));
    container = document.createElement('div');
    container.innerHTML =
      '<pre><code class="language-mermaid">graph LR; A-->B</code></pre><pre class="mermaid">graph LR; B-->C</pre>';
    jest
      .mocked(mermaid.render)
      .mockResolvedValue({ svg: '<svg><text>Healthy</text><script>alert(1)</script></svg>', diagramType: 'flowchart' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('does not initialize without enabled Mermaid configuration', async () => {
    await render({ ...command, mermaid: undefined }, container, () => false);
    expect(mermaid.initialize).not.toHaveBeenCalled();
  });

  test('forces strict configuration and sanitizes every rendered diagram', async () => {
    await render(command, container, () => false);
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        startOnLoad: false,
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        suppressErrorRendering: true,
      })
    );
    expect(mermaid.render).toHaveBeenNthCalledWith(1, 'text-mermaid-1', 'graph LR; A-->B');
    expect(mermaid.render).toHaveBeenNthCalledWith(2, 'text-mermaid-2', 'graph LR; B-->C');
    expect(container.querySelectorAll('.mermaid-diagram svg')).toHaveLength(2);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('pre')).toBeNull();
  });

  test('preserves invalid source with localized error and continues other diagrams', async () => {
    jest.mocked(mermaid.render).mockRejectedValueOnce(new Error('invalid diagram'));
    await render(command, container, () => false);
    expect(container.querySelector('[role="status"]')).toHaveTextContent('Diagram failed');
    expect(container.querySelector('code')).toHaveTextContent('graph LR; A-->B');
    expect(container.querySelectorAll('.mermaid-diagram')).toHaveLength(1);
  });

  test('cancels before rendering', async () => {
    await render(command, container, () => true);
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  test.each([false, true])('does not mutate content after cancellation (rejected: %s)', async (reject) => {
    let cancelled = false;
    jest.mocked(mermaid.render).mockImplementationOnce(async () => {
      cancelled = true;
      if (reject) {
        throw new Error('cancelled');
      }
      return { svg: '<svg></svg>', diagramType: 'flowchart' };
    });
    await render(command, container, () => cancelled);
    expect(container.querySelectorAll('pre')).toHaveLength(2);
    expect(container.querySelector('.mermaid-diagram-error')).toBeNull();
  });
});
