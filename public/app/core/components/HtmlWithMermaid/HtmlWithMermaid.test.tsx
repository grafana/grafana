import { act, render, screen } from '@testing-library/react';
import mermaid from 'mermaid';

import { HtmlWithMermaid } from './HtmlWithMermaid';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), parse: jest.fn().mockResolvedValue(true), render: jest.fn() },
}));

const mermaidRender = jest.mocked(mermaid.render);

const SOURCE = 'graph TD; A-->B;';
// What the markdown pipeline emits for a ```mermaid fence: `>` arrives escaped.
const HTML = `<h2>Flow</h2><pre><code class="language-mermaid">graph TD; A--&gt;B;</code></pre>`;

beforeEach(() => {
  jest.clearAllMocks();
  mermaidRender.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"></svg>', diagramType: 'flowchart' });
});

describe('HtmlWithMermaid', () => {
  it('replaces a mermaid fence with the rendered diagram', async () => {
    render(<HtmlWithMermaid html={HTML} />);

    expect(await screen.findByTestId('mermaid-svg')).toBeInTheDocument();
    expect(screen.getByText('Flow')).toBeInTheDocument();
    expect(screen.queryByText(SOURCE)).not.toBeInTheDocument();
  });

  it('keeps the diagram and does not draw again when re-rendered with the same html', async () => {
    const { rerender } = render(<HtmlWithMermaid html={HTML} />);
    await screen.findByTestId('mermaid-svg');
    const drawCalls = mermaidRender.mock.calls.length;

    rerender(<HtmlWithMermaid html={HTML} />);
    // Let any effect the re-render might have queued settle before asserting.
    await act(async () => {});

    expect(screen.getByTestId('mermaid-svg')).toBeInTheDocument();
    expect(mermaidRender).toHaveBeenCalledTimes(drawCalls);
  });

  it('leaves the fence as code when diagrams are off', async () => {
    render(<HtmlWithMermaid html={HTML} diagrams={false} />);

    expect(screen.getByText(SOURCE)).toBeInTheDocument();
    // Let any pending lazy import settle before asserting nothing rendered.
    await act(async () => {});
    expect(mermaidRender).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mermaid-svg')).not.toBeInTheDocument();
  });

  it('passes through div attributes to the content element', () => {
    render(<HtmlWithMermaid html="<p>Hi</p>" className="markdown-html" data-testid="content" />);

    const content = screen.getByTestId('content');
    expect(content).toHaveClass('markdown-html');
    expect(content).toContainElement(screen.getByText('Hi'));
  });
});
