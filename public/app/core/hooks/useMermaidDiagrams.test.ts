import { act, renderHook, within } from '@testing-library/react';
import mermaid from 'mermaid';

import { useMermaidDiagrams } from './useMermaidDiagrams';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), parse: jest.fn().mockResolvedValue(true), render: jest.fn() },
}));

const mermaidRender = jest.mocked(mermaid.render);

const SOURCE = 'graph TD; A-->B;';
// What the markdown pipeline emits for a ```mermaid fence: `>` arrives escaped.
const HTML = '<h2>Flow</h2><pre><code class="language-mermaid">graph TD; A--&gt;B;</code></pre>';

/** The consumer has already injected the html; the hook only gets the ref. */
function setup(html = HTML, enabled?: boolean) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const ref = { current: container };
  const hook = renderHook(({ enabled }: { enabled?: boolean }) => useMermaidDiagrams(ref, html, enabled), {
    initialProps: { enabled },
  });
  return { ...hook, container, view: within(container) };
}

beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  mermaidRender.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"></svg>', diagramType: 'flowchart' });
});

describe('useMermaidDiagrams', () => {
  it('replaces the mermaid fence inside the ref with the rendered diagram', async () => {
    const { view } = setup();

    expect(await view.findByTestId('mermaid-svg')).toBeInTheDocument();
    expect(view.getByText('Flow')).toBeInTheDocument();
    expect(view.queryByText(SOURCE)).not.toBeInTheDocument();
  });

  it('keeps the diagram and does not draw again when re-rendered with the same html', async () => {
    const { view, rerender } = setup();
    await view.findByTestId('mermaid-svg');
    const drawCalls = mermaidRender.mock.calls.length;

    rerender({ enabled: undefined });
    // Let any effect the re-render might have queued settle before asserting.
    await act(async () => {});

    expect(view.getByTestId('mermaid-svg')).toBeInTheDocument();
    expect(mermaidRender).toHaveBeenCalledTimes(drawCalls);
  });

  it('leaves the fence as code when disabled', async () => {
    const { view } = setup(HTML, false);

    expect(view.getByText(SOURCE)).toBeInTheDocument();
    // Let any pending lazy import settle before asserting nothing rendered.
    await act(async () => {});
    expect(mermaidRender).not.toHaveBeenCalled();
    expect(view.queryByTestId('mermaid-svg')).not.toBeInTheDocument();
  });
});
