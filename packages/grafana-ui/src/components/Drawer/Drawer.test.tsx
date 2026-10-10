import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { Drawer } from './Drawer';
import { DRAWER_COMPANION_ATTRIBUTE, DRAWER_CONTAINER_ATTRIBUTE } from './drawerRegion';

describe('Drawer', () => {
  // Drawer.tsx passes getContainer={'.main-view'} to RcDrawer, which tells it
  // to portal its content into the element matching that CSS selector.
  // In the real app, .main-view exists in the page shell. In tests, jsdom
  // starts with an empty body, so we create it manually — otherwise RcDrawer
  // has nowhere to render and the Drawer never appears in the DOM.
  let mainView: HTMLDivElement;

  beforeEach(() => {
    mainView = document.createElement('div');
    mainView.classList.add('main-view');
    document.body.appendChild(mainView);
  });

  afterEach(() => {
    document.body.removeChild(mainView);
  });

  it('renders with string title and children', () => {
    render(
      <Drawer title="Test Title" onClose={() => {}}>
        <div>Drawer content</div>
      </Drawer>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('has an accessible name from the visible heading when title is a string', () => {
    render(
      <Drawer title="Share" onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );

    const heading = screen.getByRole('heading', { name: 'Share' });
    expect(heading).toHaveAttribute('id');

    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveAttribute('aria-labelledby', heading.getAttribute('id'));
    // aria-label kept for e2e selector compatibility
    expect(drawer).toHaveAttribute('aria-label', selectors.components.Drawer.General.title('Share'));
  });

  it('has an accessible name from a custom title element', () => {
    render(
      <Drawer title={<h3>Custom Title</h3>} onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );

    const heading = screen.getByText('Custom Title');
    const titleWrapper = heading.closest('[id]');
    expect(titleWrapper).toHaveAttribute('id');

    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveAttribute('aria-labelledby', titleWrapper?.getAttribute('id'));
    // no aria-label for non-string titles
    expect(drawer).not.toHaveAttribute('aria-label');
  });
  it('mounts into an explicit drawer container instead of .main-view', () => {
    // e.g. the fullscreen workspace Platform tab, which has no .main-view
    document.body.removeChild(mainView);
    const container = document.createElement('div');
    container.setAttribute(DRAWER_CONTAINER_ATTRIBUTE, 'true');
    document.body.appendChild(container);

    render(
      <Drawer title="Scoped" onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );

    expect(container).toContainElement(screen.getByRole('dialog'));
    document.body.removeChild(container);
    document.body.appendChild(mainView);
  });

  it('keeps drawer companions available to assistive technology', () => {
    const companion = document.createElement('div');
    companion.setAttribute(DRAWER_COMPANION_ATTRIBUTE, 'true');
    const other = document.createElement('div');
    // Without a portal container the focus manager treats the whole body as inside
    const portalContainer = document.createElement('div');
    portalContainer.id = 'grafana-portal-container';
    document.body.append(companion, other, portalContainer);

    render(
      <Drawer title="Companion" onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );

    expect(companion).not.toHaveAttribute('aria-hidden');
    expect(other).toHaveAttribute('aria-hidden', 'true');
    companion.remove();
    other.remove();
    portalContainer.remove();
  });
});
