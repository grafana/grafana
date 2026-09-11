import { createTheme } from '@grafana/data';

import { renderMermaidDiagrams } from './mermaid';

const parse = jest.fn();
const render = jest.fn();
const initialize = jest.fn();

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: (...args: unknown[]) => initialize(...args),
    parse: (...args: unknown[]) => parse(...args),
    render: (...args: unknown[]) => render(...args),
  },
}));

const theme = createTheme();

/** The markdown pipeline's output for a fence: `>` arrives escaped. */
const FENCE = '<pre><code class="language-mermaid">graph TD\n  A[Start] --&gt; B[End]\n</code></pre>';

function container(html: string) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

async function hydrate(html: string) {
  const el = container(html);
  await renderMermaidDiagrams(el, theme, new AbortController().signal);
  return el;
}

/** A theme flip re-runs over the same DOM; only an html change rebuilds it. */
async function redraw(el: HTMLElement) {
  await renderMermaidDiagrams(el, theme, new AbortController().signal);
}

beforeEach(() => {
  jest.clearAllMocks();
  parse.mockResolvedValue(true);
  render.mockResolvedValue({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Start</text></svg>' });
});

describe('renderMermaidDiagrams', () => {
  it('replaces a markdown fence with the rendered diagram', async () => {
    const el = await hydrate(FENCE);

    expect(el.querySelector('pre')).toBeNull();
    expect(el.querySelector('.textng-mermaid svg')).not.toBeNull();
  });

  it('un-escapes the source so arrows reach mermaid as authored', async () => {
    await hydrate(FENCE);

    expect(render).toHaveBeenCalledWith(expect.any(String), 'graph TD\n  A[Start] --> B[End]\n');
  });

  it('renders <pre class="mermaid">, which is what HTML mode and Business Text panels use', async () => {
    const el = await hydrate('<pre class="mermaid">graph LR\n  A --- B\n</pre>');

    expect(render).toHaveBeenCalledWith(expect.any(String), 'graph LR\n  A --- B\n');
    expect(el.querySelector('.textng-mermaid svg')).not.toBeNull();
  });

  it('gives every diagram its own id, since mermaid renders against the document', async () => {
    await hydrate(`${FENCE}${FENCE}`);

    const [[firstId], [secondId]] = render.mock.calls;
    expect(firstId).not.toBe(secondId);
  });

  it('disables HTML labels, which the SVG sanitizer would strip', async () => {
    await hydrate(FENCE);

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ htmlLabels: false, flowchart: expect.objectContaining({ htmlLabels: false }) })
    );
  });

  it('sanitizes the rendered SVG', async () => {
    render.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>Start</text></svg>',
    });

    const el = await hydrate(FENCE);

    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('.textng-mermaid svg text')).not.toBeNull();
  });

  it('keeps the source visible and reports the error when the diagram will not parse', async () => {
    parse.mockResolvedValue(false);

    const el = await hydrate(FENCE);

    expect(render).not.toHaveBeenCalled();
    expect(el.querySelector('code.language-mermaid')).not.toBeNull();
    expect(el.querySelector('.textng-mermaid-error')?.textContent).toContain('invalid diagram syntax');
  });

  it('reports a render failure without replacing the source', async () => {
    render.mockRejectedValue(new Error('boom'));

    const el = await hydrate(FENCE);

    expect(el.querySelector('code.language-mermaid')).not.toBeNull();
    expect(el.querySelector('.textng-mermaid-error')?.textContent).toContain('boom');
  });

  it('renders the diagrams either side of a broken one', async () => {
    parse.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const el = await hydrate(`${FENCE}${FENCE}${FENCE}`);

    expect(el.querySelectorAll('.textng-mermaid svg')).toHaveLength(2);
    expect(el.querySelectorAll('.textng-mermaid-error')).toHaveLength(1);
  });

  it('drops the error message once a redraw succeeds, so a working diagram is not captioned as broken', async () => {
    parse.mockResolvedValueOnce(false);

    const el = await hydrate(FENCE);
    expect(el.querySelector('.textng-mermaid-error')).not.toBeNull();

    await redraw(el);

    expect(el.querySelector('.textng-mermaid-error')).toBeNull();
    expect(el.querySelector('.textng-mermaid svg')).not.toBeNull();
  });

  it('puts the source back when a redraw fails, rather than leaving the previous theme drawing', async () => {
    const el = await hydrate(FENCE);
    expect(el.querySelector('.textng-mermaid svg')).not.toBeNull();

    render.mockRejectedValue(new Error('boom'));
    await redraw(el);

    expect(el.querySelector('.textng-mermaid')).toBeNull();
    expect(el.querySelector('pre.mermaid')?.textContent).toBe('graph TD\n  A[Start] --> B[End]\n');
    expect(el.querySelector('.textng-mermaid-error')?.nextElementSibling).toBe(el.querySelector('pre.mermaid'));
  });

  it('renders the restored source on a later redraw', async () => {
    const el = await hydrate(FENCE);

    render.mockRejectedValueOnce(new Error('boom'));
    await redraw(el);
    await redraw(el);

    expect(render).toHaveBeenLastCalledWith(expect.any(String), 'graph TD\n  A[Start] --> B[End]\n');
    expect(el.querySelector('.textng-mermaid svg')).not.toBeNull();
    expect(el.querySelector('.textng-mermaid-error')).toBeNull();
  });

  it('updates the existing message when a redraw hits the same failure', async () => {
    parse.mockResolvedValue(false);

    const el = await hydrate(FENCE);
    await redraw(el);

    expect(el.querySelectorAll('.textng-mermaid-error')).toHaveLength(1);
  });

  it('leaves the DOM alone when the render is aborted mid-flight', async () => {
    const controller = new AbortController();
    render.mockImplementation(async () => {
      controller.abort();
      return { svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' };
    });

    const el = container(FENCE);
    await renderMermaidDiagrams(el, theme, controller.signal);

    expect(el.querySelector('code.language-mermaid')).not.toBeNull();
    expect(el.querySelector('.textng-mermaid')).toBeNull();
  });

  it('does not load mermaid for content with no diagram, prose about mermaid included', async () => {
    await hydrate('<p>We render diagrams with mermaid.</p>');

    expect(initialize).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });
});
