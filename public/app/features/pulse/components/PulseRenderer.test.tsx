import { fireEvent, render, screen } from '@testing-library/react';

import { type PulseBody } from '../types';

import { PulseRenderer } from './PulseRenderer';

describe('PulseRenderer', () => {
  it('renders plain text via React data binding', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'hello world' }] }],
      },
    };
    render(<PulseRenderer body={body} />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders text containing HTML markup as text — never as actual HTML', () => {
    const evil = '<img src=x onerror="alert(1)">';
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: evil }] }],
      },
    };
    const { container } = render(<PulseRenderer body={body} />);
    // The text appears verbatim, but no <img> element was created.
    expect(screen.getByText(evil)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('drops a link with a javascript: scheme but keeps the children as text', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'javascript:alert(1)',
                children: [{ type: 'text', text: 'click me' }],
              },
            ],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} />);
    // Children rendered as plain text…
    expect(screen.getByText('click me')).toBeInTheDocument();
    // …with no anchor element.
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders an https link with rel="noopener noreferrer"', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://grafana.com/docs',
                children: [{ type: 'text', text: 'docs' }],
              },
            ],
          },
        ],
      },
    };
    render(<PulseRenderer body={body} />);
    const a = screen.getByRole('link', { name: 'docs' });
    expect(a.getAttribute('href')).toBe('https://grafana.com/docs');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('target')).toBe('_blank');
  });

  it('rewrites markdown panel mention chips to the live panel title when renamed', () => {
    const body: PulseBody = {
      markdown: 'see `#OldName` for context',
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'see ' },
              {
                type: 'mention',
                mention: { kind: 'panel', targetId: '7', displayName: 'OldName' },
              },
              { type: 'text', text: ' for context' },
            ],
          },
        ],
      },
    };
    const titles = new Map<number, string>([[7, 'NewName']]);
    const { container } = render(<PulseRenderer body={body} panelTitlesById={titles} />);
    // `#NewName` is now in the rendered markdown; the historical
    // `#OldName` token is gone. Both checks matter — the first proves
    // the rewrite happened, the second guards against a partial replace
    // that left the stale label behind.
    expect(container.textContent).toContain('#NewName');
    expect(container.textContent).not.toContain('#OldName');
  });

  it('keeps the historical displayName when the panel was deleted', () => {
    // No entry for panel id 7 in the live map = panel removed.
    const body: PulseBody = {
      markdown: 'see `#GoneName` for context',
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'see ' },
              {
                type: 'mention',
                mention: { kind: 'panel', targetId: '7', displayName: 'GoneName' },
              },
              { type: 'text', text: ' for context' },
            ],
          },
        ],
      },
    };
    const titles = new Map<number, string>();
    const { container } = render(<PulseRenderer body={body} panelTitlesById={titles} />);
    expect(container.textContent).toContain('#GoneName');
  });

  it('rewrites AST-only panel mention chips to the live title (legacy bodies)', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'see ' },
              {
                type: 'mention',
                mention: { kind: 'panel', targetId: '7', displayName: 'OldName' },
              },
            ],
          },
        ],
      },
    };
    const titles = new Map<number, string>([[7, 'NewName']]);
    render(<PulseRenderer body={body} panelTitlesById={titles} />);
    expect(screen.getByText('#NewName')).toBeInTheDocument();
    expect(screen.queryByText('#OldName')).toBeNull();
  });

  it('rewrites markdown time mention chips into navigable anchor tags', () => {
    const body: PulseBody = {
      markdown: 'spike `@Last 1h`',
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'spike ' },
              {
                type: 'mention',
                mention: { kind: 'time', targetId: '1716393600000|1716397200000', displayName: 'Last 1h' },
              },
            ],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} dashboardUID="abc-123" />);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor!.getAttribute('href')).toBe('/d/abc-123?from=1716393600000&to=1716397200000');
    // The chip styling comes from the nested <code>; checking the
    // anchor wraps a `<code>` proves the markdown rewrite produced
    // `[`@Last 1h`](href)` and not a plain `[@Last 1h](href)`.
    expect(anchor!.querySelector('code')).not.toBeNull();
    expect(container.textContent).toContain('@Last 1h');
  });

  it('leaves time mention chips static when no dashboard target is known', () => {
    const body: PulseBody = {
      markdown: 'spike `@Last 1h`',
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'spike ' },
              {
                type: 'mention',
                mention: { kind: 'time', targetId: '1716393600000|1716397200000', displayName: 'Last 1h' },
              },
            ],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} />);
    // No dashboardUID → no anchor is synthesized; the chip stays
    // inert as a styled <code> block.
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('@Last 1h');
  });

  it('routes a plain click on a markdown-rendered time chip through onTimeChipClick', () => {
    const body: PulseBody = {
      markdown: 'spike `@Last 1h`',
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'spike ' },
              {
                type: 'mention',
                mention: { kind: 'time', targetId: '1716393600000|1716397200000', displayName: 'Last 1h' },
              },
            ],
          },
        ],
      },
    };
    const onTimeChipClick = jest.fn();
    const { container } = render(
      <PulseRenderer body={body} dashboardUID="abc-123" onTimeChipClick={onTimeChipClick} />
    );
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    fireEvent.click(anchor!, { button: 0 });
    expect(onTimeChipClick).toHaveBeenCalledWith(1716393600000, 1716397200000);
  });

  it('lets cmd/ctrl-click on a time chip fall through to native navigation', () => {
    const body: PulseBody = {
      markdown: 'spike `@Last 1h`',
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'mention',
                mention: { kind: 'time', targetId: '1716393600000|1716397200000', displayName: 'Last 1h' },
              },
            ],
          },
        ],
      },
    };
    const onTimeChipClick = jest.fn();
    const { container } = render(
      <PulseRenderer body={body} dashboardUID="abc-123" onTimeChipClick={onTimeChipClick} />
    );
    const anchor = container.querySelector('a');
    fireEvent.click(anchor!, { button: 0, metaKey: true });
    expect(onTimeChipClick).not.toHaveBeenCalled();
  });

  it('routes a plain click on an AST-rendered time chip through onTimeChipClick', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'mention',
                mention: { kind: 'time', targetId: '1716393600000|1716397200000', displayName: 'Last 1h' },
              },
            ],
          },
        ],
      },
    };
    const onTimeChipClick = jest.fn();
    const { container } = render(
      <PulseRenderer body={body} dashboardUID="abc-123" onTimeChipClick={onTimeChipClick} />
    );
    const anchor = container.querySelector('a');
    fireEvent.click(anchor!, { button: 0 });
    expect(onTimeChipClick).toHaveBeenCalledWith(1716393600000, 1716397200000);
  });

  it('renders AST-only time mention chips as anchor tags (legacy bodies)', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'mention',
                mention: { kind: 'time', targetId: '1716393600000|1716397200000', displayName: 'Last 1h' },
              },
            ],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} dashboardUID="abc-123" />);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor!.getAttribute('href')).toBe('/d/abc-123?from=1716393600000&to=1716397200000');
  });

  it('falls back to a static chip when a time mention has a malformed range', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'mention',
                // A malformed range can't happen via the API (the
                // backend rejects it) but the chip must still degrade
                // safely if a corrupt body somehow reaches the renderer.
                mention: { kind: 'time', targetId: 'broken', displayName: 'Some time' },
              },
            ],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} dashboardUID="abc-123" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('@Some time');
  });

  it('renders an unknown node type as its plain children, not as HTML', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'iframe',
            children: [{ type: 'text', text: 'should never see an iframe' }],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} />);
    expect(screen.getByText('should never see an iframe')).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
  });
});
