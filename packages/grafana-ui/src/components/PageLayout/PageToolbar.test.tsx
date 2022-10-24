import { render, screen } from '@testing-library/react';
import React from 'react';

import { PageToolbar } from '..';

describe('PageToolbar', () => {
  it('renders left items when title is not set', () => {
    const leftItemContent = 'Left Item!';
    render(<PageToolbar leftItems={[<div key="left-item">{leftItemContent}</div>]} />);

    expect(screen.getByText(leftItemContent)).toBeInTheDocument();
  });
});
