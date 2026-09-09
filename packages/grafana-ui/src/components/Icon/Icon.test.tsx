import { render, screen, waitFor } from '@testing-library/react';
import { cacheStore } from 'react-inlinesvg';

import { Icon } from './Icon';
import { clearSvgElementCache } from './useSvgElement';
import { getIconPath } from './utils';

const HEART_SRC = getIconPath('heart');
const HEART_PATH = 'M12 21a1 1 0 0 1-.71-.29l-7.77-7.78a5.26 5.26 0 0 1 7.44-7.44l1 1 1-1a5.26 5.26 0 0 1 7.44 7.44Z';
const HEART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${HEART_PATH}"/></svg>`;

beforeEach(async () => {
  clearSvgElementCache();
  await cacheStore.clear();
  cacheStore.set(HEART_SRC, { content: HEART_SVG, status: 'loaded' });
});

describe('Icon', () => {
  it('should render an icon', () => {
    render(<Icon name="heart" />);

    const svg = screen.getByTestId('icon-heart');
    expect(svg.tagName).toBe('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg.querySelector('path')).toHaveAttribute('d', HEART_PATH);
  });

  it('should render with correct size', () => {
    render(<Icon name="heart" size="lg" />);

    const svg = screen.getByTestId('icon-heart');
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
  });

  it('should set aria-hidden when no accessibility props provided', () => {
    render(<Icon name="heart" />);

    expect(screen.getByTestId('icon-heart')).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render the title as a child element when provided', () => {
    render(<Icon name="heart" title="Heart icon" />);

    const svg = screen.getByTestId('icon-heart');
    expect(svg).toHaveAttribute('aria-hidden', 'false');
    expect(svg.querySelector('title')).toHaveTextContent('Heart icon');
    // the icon contents are still rendered alongside the title
    expect(svg.querySelector('path')).toBeInTheDocument();
  });

  it('should spin the spinner', () => {
    // Not a great test - because the class name is generated we can't know if it's actually applied the spin class
    // so we just check that the class name changes when its the spinner
    render(<Icon name="heart" />);
    const baseClassName = screen.getByTestId('icon-heart').getAttribute('class') || '';

    render(<Icon name="spinner" />);

    const newClassName = screen.getByTestId('icon-spinner').getAttribute('class') || '';
    expect(newClassName).not.toBe(baseClassName);
  });

  it('should update icon when name prop changes', () => {
    cacheStore.set(getIconPath('star'), {
      content: '<svg viewBox="0 0 24 24"><path id="star-path" d="M1 1"/></svg>',
      status: 'loaded',
    });

    const { rerender } = render(<Icon name="heart" />);
    expect(screen.getByTestId('icon-heart').querySelector('path')).toHaveAttribute('d', HEART_PATH);

    rerender(<Icon name="star" />);

    expect(screen.queryByTestId('icon-heart')).not.toBeInTheDocument();
    expect(screen.getByTestId('icon-star').querySelector('path')).toHaveAttribute('id', 'star-path');
  });

  it('should render a placeholder of the right size until an uncached icon loads', async () => {
    cacheStore.set(HEART_SRC, { content: HEART_SVG, status: 'loading' });

    const { container } = render(<Icon name="heart" size="xl" />);

    // no icon yet, but a placeholder holding the space so the layout doesn't shift
    expect(screen.queryByTestId('icon-heart')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();

    expect(await screen.findByTestId('icon-heart')).toHaveAttribute('width', '24');
  });

  it('should end up on the last icon when the name changes while one is still loading', async () => {
    const starSrc = getIconPath('star');
    cacheStore.set(HEART_SRC, { content: HEART_SVG, status: 'loading' });
    cacheStore.set(starSrc, {
      content: '<svg viewBox="0 0 24 24"><path id="star-path" d="M1 1"/></svg>',
      status: 'loading',
    });

    const { rerender } = render(<Icon name="heart" />);
    rerender(<Icon name="star" />);

    expect(await screen.findByTestId('icon-star')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-heart')).not.toBeInTheDocument();
  });

  it('should render nothing when the icon fails to load', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    cacheStore.set(HEART_SRC, { content: '', error: new Error('nope'), status: 'failed' });

    const { container } = render(<Icon name="heart" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('should convert an icon once however many times it is rendered', () => {
    const parse = jest.spyOn(DOMParser.prototype, 'parseFromString');

    render(
      <>
        <Icon name="heart" />
        <Icon name="heart" size="xl" />
        <Icon name="heart" title="Favourite" />
      </>
    );

    expect(screen.getAllByTestId('icon-heart')).toHaveLength(3);
    expect(parse).toHaveBeenCalledTimes(1);

    parse.mockRestore();
  });

  it('should not reconvert an icon when it is remounted', () => {
    const parse = jest.spyOn(DOMParser.prototype, 'parseFromString');

    // virtualized surfaces mount and unmount the same icons constantly
    for (let i = 0; i < 5; i++) {
      render(<Icon name="heart" />).unmount();
    }

    expect(parse).toHaveBeenCalledTimes(1);

    parse.mockRestore();
  });
});
