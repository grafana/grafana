import { render, screen } from '@testing-library/react';
import React from 'react';

import { PageToolbar } from '..';

const resizeWindow = (x: number, y: number) => {
  global.innerWidth = x;
  global.innerHeight = y;
  global.dispatchEvent(new Event('resize'));
};

describe('PageToolbar', () => {
  it('renders left items when title is not set', () => {
    const leftItemContent = 'Left Item!';
    render(<PageToolbar leftItems={[<div key="left-item">{leftItemContent}</div>]} />);

    expect(screen.getByText(leftItemContent)).toBeInTheDocument();
  });

  describe('On small screens', () => {
    const windowWidth = global.innerWidth,
      windowHeight = global.innerHeight;

    beforeAll(() => {
      resizeWindow(500, 500);
    });

    afterAll(() => {
      resizeWindow(windowWidth, windowHeight);
    });

    it('left items are not visible', () => {
      const leftItemContent = 'Left Item!';
      render(<PageToolbar leftItems={[<div key="left-item">{leftItemContent}</div>]} />);

      expect(screen.getByText(leftItemContent)).not.toBeVisible();
    });

    it('left items are visible when forceShowLeftItems is true', () => {
      const leftItemContent = 'Left Item!';
      render(<PageToolbar forceShowLeftItems leftItems={[<div key="left-item">{leftItemContent}</div>]} />);

      expect(screen.getByText(leftItemContent)).toBeVisible();
    });
  });
});
