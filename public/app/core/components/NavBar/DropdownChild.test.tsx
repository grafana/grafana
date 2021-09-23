import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DropdownChild from './DropdownChild';

describe('DropdownChild', () => {
  const mockText = 'MyChildItem';
  const mockUrl = '/route';
  const mockIcon = 'home-alt';

  it('displays the text', () => {
    render(<DropdownChild text={mockText} />);
    const text = screen.getByText(mockText);
    expect(text).toBeInTheDocument();
  });

  it('attaches the url to the text if provided', () => {
    render(
      <BrowserRouter>
        <DropdownChild text={mockText} url={mockUrl} />
      </BrowserRouter>
    );
    const link = screen.getByRole('link', { name: mockText });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', mockUrl);
  });

  it('displays an icon if a valid icon is provided', () => {
    render(<DropdownChild text={mockText} icon={mockIcon} />);
    const icon = screen.getByTestId('dropdown-child-icon');
    expect(icon).toBeInTheDocument();
  });

  it('displays a divider instead when isDivider is true', () => {
    render(<DropdownChild text={mockText} icon={mockIcon} url={mockUrl} isDivider />);

    // Check the divider is shown
    const divider = screen.getByTestId('dropdown-child-divider');
    expect(divider).toBeInTheDocument();

    // Check nothing else is rendered
    const text = screen.queryByText(mockText);
    const icon = screen.queryByTestId('dropdown-child-icon');
    const link = screen.queryByRole('link', { name: mockText });
    expect(text).not.toBeInTheDocument();
    expect(icon).not.toBeInTheDocument();
    expect(link).not.toBeInTheDocument();
  });
});
