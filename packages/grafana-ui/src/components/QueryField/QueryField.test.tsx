import { render, screen, waitFor } from '@testing-library/react';

import { QueryField } from './QueryField';

describe('<QueryField />', () => {
  it('renders the latest query when the editor loads', async () => {
    const props = { portalOrigin: 'mock-origin' };
    const { rerender, unmount } = render(<QueryField {...props} query="initial query" />);

    rerender(<QueryField {...props} query="updated query" syntaxLoaded />);

    expect(await screen.findByText('updated query')).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });

  it('should render with null initial value', async () => {
    expect(() => render(<QueryField query={null} onTypeahead={jest.fn()} portalOrigin="mock-origin" />)).not.toThrow();
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument());
  });

  it('should render with empty initial value', async () => {
    expect(() => render(<QueryField query="" onTypeahead={jest.fn()} portalOrigin="mock-origin" />)).not.toThrow();
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument());
  });

  it('should render with initial value', async () => {
    expect(() =>
      render(<QueryField query="my query" onTypeahead={jest.fn()} portalOrigin="mock-origin" />)
    ).not.toThrow();
    expect(await screen.findByText('my query')).toBeInTheDocument();
  });

  describe('syntaxLoaded', () => {
    it('should re-render the editor after syntax has fully loaded', async () => {
      const mockOnRichValueChange = jest.fn();
      const { rerender } = render(
        <QueryField query="my query" onRichValueChange={mockOnRichValueChange} portalOrigin="mock-origin" />
      );
      await screen.findByText('my query');
      rerender(
        <QueryField
          query="my query"
          syntaxLoaded
          onRichValueChange={mockOnRichValueChange}
          portalOrigin="mock-origin"
        />
      );
      expect(mockOnRichValueChange).toHaveBeenCalled();

      // wait for the query to appear to prevent act warnings
      await screen.findByText('my query');
    });

    it('should not re-render the editor if syntax is already loaded', async () => {
      const mockOnRichValueChange = jest.fn();
      const { rerender } = render(
        <QueryField
          query="my query"
          onRichValueChange={mockOnRichValueChange}
          syntaxLoaded
          portalOrigin="mock-origin"
        />
      );
      await screen.findByText('my query');
      rerender(
        <QueryField
          query="my query"
          onRichValueChange={mockOnRichValueChange}
          syntaxLoaded
          portalOrigin="mock-origin"
        />
      );
      expect(mockOnRichValueChange).not.toHaveBeenCalled();

      // wait for the query to appear to prevent act warnings
      await screen.findByText('my query');
    });

    it('should not re-render the editor twice once syntax is fully loaded', async () => {
      const mockOnRichValueChange = jest.fn();
      const { rerender } = render(
        <QueryField onRichValueChange={mockOnRichValueChange} query="my query" portalOrigin="mock-origin" />
      );
      await screen.findByText('my query');
      rerender(
        <QueryField
          syntaxLoaded
          onRichValueChange={mockOnRichValueChange}
          query="my query"
          portalOrigin="mock-origin"
        />
      );
      rerender(
        <QueryField
          syntaxLoaded
          onRichValueChange={mockOnRichValueChange}
          query="my query"
          portalOrigin="mock-origin"
        />
      );
      expect(mockOnRichValueChange).toHaveBeenCalledTimes(1);

      // wait for the query to appear to prevent act warnings
      await screen.findByText('my query');
    });
  });
});
