import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NavBarDropdown from './NavBarDropdown';

describe('NavBarDropdown', () => {
  const mockHeaderText = 'MyHeaderText';
  const mockHeaderUrl = '/route';
  const mockOnHeaderClick = jest.fn();
  const mockItems = [
    {
      text: 'First link',
    },
    {
      text: 'Second link',
    },
  ];

  it('displays the header text', () => {
    render(<NavBarDropdown headerText={mockHeaderText} />);
    const text = screen.getByText(mockHeaderText);
    expect(text).toBeInTheDocument();
  });

  it('attaches the header url to the header text if provided', () => {
    render(
      <BrowserRouter>
        <NavBarDropdown headerText={mockHeaderText} headerUrl={mockHeaderUrl} isVisible />
      </BrowserRouter>
    );
    const link = screen.getByRole('link', { name: mockHeaderText });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', mockHeaderUrl);
  });

  it('calls the onHeaderClick function when the header is clicked', () => {
    render(<NavBarDropdown headerText={mockHeaderText} onHeaderClick={mockOnHeaderClick} />);
    const text = screen.getByText(mockHeaderText);
    expect(text).toBeInTheDocument();
    userEvent.click(text);
    expect(mockOnHeaderClick).toHaveBeenCalled();
  });

  it('displays the items', () => {
    render(<NavBarDropdown headerText={mockHeaderText} items={mockItems} />);
    mockItems.forEach(({ text }) => {
      const childItem = screen.getByText(text);
      expect(childItem).toBeInTheDocument();
    });
  });
});
