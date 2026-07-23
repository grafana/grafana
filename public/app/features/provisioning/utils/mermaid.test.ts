import mermaid from 'mermaid';

import {
  MERMAID_DIAGRAM_CLASS,
  MERMAID_ERROR_CLASS,
  MERMAID_CODE_SELECTOR,
  renderMermaidDiagrams,
} from './mermaid';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(),
  },
}));

const mockInitialize = mermaid.initialize as jest.MockedFunction<typeof mermaid.initialize>;
const mockRender = mermaid.render as jest.MockedFunction<typeof mermaid.render>;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Builds a container with `html`, attached to the document so `isConnected` is true. */
function mountContainer(html: string): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

/** Markup that `marked` produces for a ```mermaid fenced block. */
function mermaidBlock(source: string): string {
  return `<pre><code class="language-mermaid">${source}</code></pre>`;
}

describe('renderMermaidDiagrams', () => {
  beforeEach(() => {
    mockInitialize.mockReset();
    mockRender.mockReset();
    mockRender.mockResolvedValue({ svg: '<svg data-testid="diagram"></svg>' } as never);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not load or invoke mermaid when there are no diagrams', async () => {
    const container = mountContainer('<p>Just prose, no diagrams.</p>');

    await renderMermaidDiagrams(container, { isDark: false });

    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('replaces a rendered mermaid code block with its diagram', async () => {
    const container = mountContainer(mermaidBlock('graph TD; A--&gt;B;'));

    await renderMermaidDiagrams(container, { isDark: false });

    expect(container.querySelector(MERMAID_CODE_SELECTOR)).toBeNull();
    const diagram = container.querySelector(`.${MERMAID_DIAGRAM_CLASS}`);
    expect(diagram).not.toBeNull();
    expect(diagram!.querySelector('[data-testid="diagram"]')).not.toBeNull();
  });

  it('passes the decoded source text to mermaid, not the HTML-escaped markup', async () => {
    const container = mountContainer(mermaidBlock('graph TD; A--&gt;B;'));

    await renderMermaidDiagrams(container, { isDark: false });

    expect(mockRender).toHaveBeenCalledWith(expect.any(String), 'graph TD; A-->B;');
  });

  it('uses the dark theme with strict security when isDark is true', async () => {
    const container = mountContainer(mermaidBlock('graph TD; A-->B;'));

    await renderMermaidDiagrams(container, { isDark: true });

    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'dark',
        securityLevel: 'strict',
        startOnLoad: false,
        suppressErrorRendering: true,
      })
    );
  });

  it('uses the default (light) theme when isDark is false', async () => {
    const container = mountContainer(mermaidBlock('graph TD; A-->B;'));

    await renderMermaidDiagrams(container, { isDark: false });

    expect(mockInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'default' }));
  });

  it('renders multiple diagrams with unique ids', async () => {
    const container = mountContainer(mermaidBlock('graph TD; A-->B;') + mermaidBlock('graph LR; C-->D;'));

    await renderMermaidDiagrams(container, { isDark: false });

    expect(container.querySelectorAll(`.${MERMAID_DIAGRAM_CLASS}`)).toHaveLength(2);
    expect(mockRender).toHaveBeenCalledTimes(2);
    const [firstId] = mockRender.mock.calls[0];
    const [secondId] = mockRender.mock.calls[1];
    expect(firstId).not.toEqual(secondId);
  });

  it('handles a mermaid code block that has no <pre> wrapper', async () => {
    const container = mountContainer('<code class="language-mermaid">graph TD; A-->B;</code>');

    await renderMermaidDiagrams(container, { isDark: false });

    expect(container.querySelector(MERMAID_CODE_SELECTOR)).toBeNull();
    expect(container.querySelector(`.${MERMAID_DIAGRAM_CLASS}`)).not.toBeNull();
  });

  it('flags the block and keeps the source when a diagram fails to render', async () => {
    mockRender.mockRejectedValue(new Error('parse error'));
    const container = mountContainer(mermaidBlock('not a valid diagram'));

    await renderMermaidDiagrams(container, { isDark: false });

    const failed = container.querySelector(`.${MERMAID_ERROR_CLASS}`);
    expect(failed).not.toBeNull();
    // Source stays visible so the rest of the README is unaffected.
    expect(container.querySelector(MERMAID_CODE_SELECTOR)?.textContent).toBe('not a valid diagram');
    expect(container.querySelector(`.${MERMAID_DIAGRAM_CLASS}`)).toBeNull();
  });

  it('renders remaining diagrams even if an earlier one fails', async () => {
    mockRender
      .mockRejectedValueOnce(new Error('parse error'))
      .mockResolvedValueOnce({ svg: '<svg data-testid="diagram"></svg>' } as never);
    const container = mountContainer(mermaidBlock('broken') + mermaidBlock('graph TD; A-->B;'));

    await renderMermaidDiagrams(container, { isDark: false });

    expect(container.querySelector(`.${MERMAID_ERROR_CLASS}`)).not.toBeNull();
    expect(container.querySelector(`.${MERMAID_DIAGRAM_CLASS}`)).not.toBeNull();
  });

  it('does not mutate the DOM once the signal is cancelled', async () => {
    let resolveRender: (value: { svg: string }) => void = () => {};
    mockRender.mockImplementation(() => new Promise((resolve) => (resolveRender = resolve)));
    const container = mountContainer(mermaidBlock('graph TD; A-->B;'));
    const signal = { cancelled: false };

    const done = renderMermaidDiagrams(container, { isDark: false, signal });
    // Let execution reach the awaited mermaid.render call.
    await flushPromises();

    signal.cancelled = true;
    resolveRender({ svg: '<svg data-testid="diagram"></svg>' });
    await done;

    // The block should be left untouched because cancellation happened mid-render.
    expect(container.querySelector(MERMAID_CODE_SELECTOR)).not.toBeNull();
    expect(container.querySelector(`.${MERMAID_DIAGRAM_CLASS}`)).toBeNull();
  });
});
