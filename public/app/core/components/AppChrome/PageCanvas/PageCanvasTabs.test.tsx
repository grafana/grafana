import { fireEvent, render, screen, within } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { PageCanvasFrame } from './PageCanvasFrame';
import { PageCanvasTabs } from './PageCanvasTabs';
import { type PageCanvasModel, type PageCanvasTab } from './types';

const tab = (id: string, overrides: Partial<PageCanvasTab> = {}): PageCanvasTab => ({
  id,
  label: id,
  closable: true,
  reorderable: true,
  shows: 'pane',
  ...overrides,
});

const makeCanvas = (overrides: Partial<PageCanvasModel> = {}): PageCanvasModel => ({
  label: 'Canvas',
  tabs: [tab('Report'), tab('Sources', { count: 4 }), tab('Checkout latency', { shows: 'page', href: '/d/checkout' })],
  activeTabId: 'Report',
  closedTabs: [tab('Hypotheses')],
  onSelect: jest.fn(),
  onClose: jest.fn(),
  onReopen: jest.fn(),
  onReorder: jest.fn(),
  onOpenAsPage: jest.fn(),
  onCloseCanvas: jest.fn(),
  ...overrides,
});

// The test render installs its own location service, so read the location after rendering.
const currentPath = () => {
  const { pathname, search } = locationService.getLocation();
  return `${pathname}${search}`;
};

describe('PageCanvasTabs', () => {
  it('lists the open tabs in a tab list named after the canvas', () => {
    render(<PageCanvasTabs canvas={makeCanvas()} paneId="pane" />);
    const tabList = screen.getByRole('tablist', { name: 'Canvas' });
    expect(
      within(tabList)
        .getAllByRole('tab')
        .map((element) => element.textContent)
    ).toEqual(['Report', 'Sources4', 'Checkout latency']);
    expect(screen.getByRole('tab', { name: 'Report' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Report' })).toHaveAttribute('aria-controls', 'pane');
    expect(screen.getByRole('tab', { name: 'Checkout latency' })).toHaveAttribute('aria-controls', 'pageContent');
  });

  it('selects a pane tab, and shows a page tab’s page before selecting it', async () => {
    const canvas = makeCanvas();
    const { user } = render(<PageCanvasTabs canvas={canvas} paneId="pane" />);
    const startPath = currentPath();
    await user.click(screen.getByRole('tab', { name: /^Sources/ }));
    expect(canvas.onSelect).toHaveBeenLastCalledWith('Sources');
    expect(currentPath()).toBe(startPath);

    await user.click(screen.getByRole('tab', { name: 'Checkout latency' }));
    expect(currentPath()).toBe('/d/checkout');
    expect(canvas.onSelect).toHaveBeenLastCalledWith('Checkout latency');
  });

  it('closes a tab from its close button, the Delete key and a middle click', async () => {
    const canvas = makeCanvas();
    const { user } = render(<PageCanvasTabs canvas={canvas} paneId="pane" />);
    await user.click(screen.getByRole('button', { name: 'Close Sources' }));
    expect(canvas.onClose).toHaveBeenLastCalledWith(['Sources']);

    screen.getByRole('tab', { name: 'Report' }).focus();
    await user.keyboard('{Delete}');
    expect(canvas.onClose).toHaveBeenLastCalledWith(['Report']);

    fireEvent(
      screen.getByRole('tab', { name: 'Checkout latency' }),
      new MouseEvent('auxclick', { bubbles: true, button: 1 })
    );
    expect(canvas.onClose).toHaveBeenLastCalledWith(['Checkout latency']);
  });

  it('offers no close for a tab that cannot close', () => {
    render(<PageCanvasTabs canvas={makeCanvas({ tabs: [tab('Report', { closable: false })] })} paneId="pane" />);
    expect(screen.queryByRole('button', { name: 'Close Report' })).not.toBeInTheDocument();
  });

  it('moves the focused tab with Alt+Shift+Arrow, and arrows move focus', async () => {
    const canvas = makeCanvas();
    const { user } = render(<PageCanvasTabs canvas={canvas} paneId="pane" />);
    screen.getByRole('tab', { name: 'Report' }).focus();
    await user.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    expect(canvas.onReorder).toHaveBeenCalledWith(['Sources', 'Report', 'Checkout latency']);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^Sources/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Checkout latency' })).toHaveFocus();
  });

  it('closes other tabs and tabs to the right from the context menu', async () => {
    const canvas = makeCanvas();
    const { user } = render(<PageCanvasTabs canvas={canvas} paneId="pane" />);
    await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('tab', { name: /^Sources/ }) });
    expect(screen.getByRole('menuitem', { name: /^Close tab(?!s)/ })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Close other tabs' }));
    expect(canvas.onClose).toHaveBeenLastCalledWith(['Report', 'Checkout latency']);

    await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('tab', { name: 'Report' }) });
    await user.click(screen.getByRole('menuitem', { name: 'Close tabs to the right' }));
    expect(canvas.onClose).toHaveBeenLastCalledWith(['Sources', 'Checkout latency']);
  });

  it('opens a tab with a Grafana page as that page, from the menu and the strip', async () => {
    const canvas = makeCanvas({ activeTabId: 'Checkout latency' });
    const { user } = render(<PageCanvasTabs canvas={canvas} paneId="pane" />);
    await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('tab', { name: 'Checkout latency' }) });
    await user.click(screen.getByRole('menuitem', { name: 'Open as a Grafana page' }));
    expect(currentPath()).toBe('/d/checkout');
    expect(canvas.onOpenAsPage).toHaveBeenCalledWith('Checkout latency');

    await user.click(screen.getByRole('button', { name: 'Open as a Grafana page' }));
    expect(canvas.onOpenAsPage).toHaveBeenCalledTimes(2);
  });

  it('offers Open as a Grafana page only for a tab with a page', async () => {
    const { user } = render(<PageCanvasTabs canvas={makeCanvas()} paneId="pane" />);
    expect(screen.queryByRole('button', { name: 'Open as a Grafana page' })).not.toBeInTheDocument();
    await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('tab', { name: 'Report' }) });
    expect(screen.queryByRole('menuitem', { name: 'Open as a Grafana page' })).not.toBeInTheDocument();
  });

  it('closes the canvas', async () => {
    const canvas = makeCanvas();
    const { user } = render(<PageCanvasTabs canvas={canvas} paneId="pane" />);
    await user.click(screen.getByRole('button', { name: 'Close canvas (Alt+C)' }));
    expect(canvas.onCloseCanvas).toHaveBeenCalled();
  });
});

describe('PageCanvasFrame', () => {
  const renderFrame = (canvas: PageCanvasModel | null) =>
    render(
      <PageCanvasFrame
        canvas={canvas}
        pane={<div>Pane content</div>}
        renderPage={(covered) => (
          <main id="pageContent" inert={covered}>
            <input aria-label="Page field" />
          </main>
        )}
      />
    );

  it('covers the page while a pane tab is active, and shows it for a page tab', () => {
    const { rerender } = renderFrame(makeCanvas());
    expect(screen.getByRole('tabpanel', { name: 'Report' })).toHaveTextContent('Pane content');
    expect(document.getElementById('pageContent')).toHaveAttribute('inert');

    rerender(
      <PageCanvasFrame
        canvas={makeCanvas({ activeTabId: 'Checkout latency' })}
        pane={<div>Pane content</div>}
        renderPage={(covered) => <main id="pageContent" inert={covered} />}
      />
    );
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(document.getElementById('pageContent')).not.toHaveAttribute('inert');
  });

  it('shows no strip and leaves the page alone without a canvas', () => {
    renderFrame(null);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(document.getElementById('pageContent')).not.toHaveAttribute('inert');
  });

  it('offers to reopen every tab when all are closed', async () => {
    const canvas = makeCanvas({ tabs: [], closedTabs: [tab('Report'), tab('Sources')] });
    const { user } = renderFrame(canvas);
    expect(screen.getByRole('heading', { name: 'All tabs are closed' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reopen all tabs' }));
    expect(canvas.onReopen).toHaveBeenCalledWith(['Report', 'Sources']);
  });

  it('handles Alt+W, Alt+Shift+T and Alt+C, but not while typing', async () => {
    const canvas = makeCanvas({ activeTabId: 'Checkout latency' });
    const { user } = renderFrame(canvas);
    await user.keyboard('{Alt>}w{/Alt}');
    expect(canvas.onClose).toHaveBeenCalledWith(['Checkout latency']);
    await user.keyboard('{Alt>}{Shift>}t{/Shift}{/Alt}');
    expect(canvas.onSelect).toHaveBeenCalledWith('Hypotheses');
    await user.keyboard('{Alt>}c{/Alt}');
    expect(canvas.onCloseCanvas).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('textbox', { name: 'Page field' }));
    await user.keyboard('{Alt>}c{/Alt}');
    expect(canvas.onCloseCanvas).toHaveBeenCalledTimes(1);
  });
});
