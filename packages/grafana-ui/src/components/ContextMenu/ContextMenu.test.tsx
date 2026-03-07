import { render, screen, waitFor } from '@testing-library/react';

import { Menu } from '../Menu/Menu';

import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: originalInnerHeight,
    });
  });

  it('constrains height and keeps the menu scrollable when content exceeds viewport height', async () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 120,
    });

    render(
      <ContextMenu
        x={100}
        y={110}
        renderMenuItems={() =>
          Array.from({ length: 40 }, (_, index) => <Menu.Item key={index} label={`Menu item ${index}`} />)
        }
      />
    );

    const menu = await screen.findByRole('menu');
    const floatingElement = menu.parentElement?.parentElement?.parentElement as HTMLDivElement;

    await waitFor(() => {
      expect(floatingElement.style.getPropertyValue('--context-menu-max-height')).not.toBe('');
      expect(floatingElement.style.maxHeight).not.toBe('');
    });

    const maxHeight = parseFloat(floatingElement.style.getPropertyValue('--context-menu-max-height'));
    expect(maxHeight).toBeLessThanOrEqual(window.innerHeight);
    expect(floatingElement.style.overflowY).toBe('auto');
    expect(getComputedStyle(menu.parentElement as HTMLElement).overflowY).toBe('auto');
  });
});
