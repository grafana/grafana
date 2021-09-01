import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SideMenuItem from './SideMenuItem';

describe('SideMenuItem', () => {
  it('renders the children', () => {
    const mockLabel = 'Hello';
    render(
      <BrowserRouter>
        <SideMenuItem label={mockLabel}>
          <div data-testid="mockChild" />
        </SideMenuItem>
      </BrowserRouter>
    );

    const child = screen.getByTestId('mockChild');
    expect(child).toBeInTheDocument();
  });

  it('wraps the children in a link to the url if provided', () => {
    const mockLabel = 'Hello';
    const mockUrl = '/route';
    render(
      <BrowserRouter>
        <SideMenuItem label={mockLabel} url={mockUrl}>
          <div data-testid="mockChild" />
        </SideMenuItem>
      </BrowserRouter>
    );

    const child = screen.getByTestId('mockChild');
    expect(child).toBeInTheDocument();
    userEvent.click(child);
    expect(window.location.pathname).toEqual(mockUrl);
  });

  it('wraps the children in an onClick if provided', () => {
    const mockLabel = 'Hello';
    const mockOnClick = jest.fn();
    render(
      <BrowserRouter>
        <SideMenuItem label={mockLabel} onClick={mockOnClick}>
          <div data-testid="mockChild" />
        </SideMenuItem>
      </BrowserRouter>
    );

    const child = screen.getByTestId('mockChild');
    expect(child).toBeInTheDocument();
    userEvent.click(child);
    expect(mockOnClick).toHaveBeenCalled();
  });
});
