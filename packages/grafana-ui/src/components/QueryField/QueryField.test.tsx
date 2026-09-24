import { render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import Plain from 'slate-plain-serializer';

import { createTheme } from '@grafana/data';

import { UnThemedQueryField } from './QueryField';

describe('<QueryField />', () => {
  it('renders the latest query when the editor loads and preserves its ref until unmount', async () => {
    const ref = createRef<UnThemedQueryField>();
    const props = { theme: createTheme(), portalOrigin: 'mock-origin', ref };
    const { rerender, unmount } = render(<UnThemedQueryField {...props} query="initial query" />);

    rerender(<UnThemedQueryField {...props} query="updated query" syntaxLoaded />);

    expect(await screen.findByText('updated query')).toBeInTheDocument();
    const field = ref.current!;
    expect(Plain.serialize(field.editor!.value)).toBe('updated query');

    unmount();
    expect(field.editor).toBeNull();
  });

  it('should render with null initial value', async () => {
    expect(() =>
      render(
        <UnThemedQueryField theme={createTheme()} query={null} onTypeahead={jest.fn()} portalOrigin="mock-origin" />
      )
    ).not.toThrow();
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument());
  });

  it('should render with empty initial value', async () => {
    expect(() =>
      render(<UnThemedQueryField theme={createTheme()} query="" onTypeahead={jest.fn()} portalOrigin="mock-origin" />)
    ).not.toThrow();
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument());
  });

  it('should render with initial value', async () => {
    expect(() =>
      render(
        <UnThemedQueryField theme={createTheme()} query="my query" onTypeahead={jest.fn()} portalOrigin="mock-origin" />
      )
    ).not.toThrow();
    expect(await screen.findByText('my query')).toBeInTheDocument();
  });

  describe('syntaxLoaded', () => {
    it('should re-render the editor after syntax has fully loaded', async () => {
      const mockOnRichValueChange = jest.fn();
      const { rerender } = render(
        <UnThemedQueryField
          theme={createTheme()}
          query="my query"
          onRichValueChange={mockOnRichValueChange}
          portalOrigin="mock-origin"
        />
      );
      await screen.findByText('my query');
      rerender(
        <UnThemedQueryField
          theme={createTheme()}
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
        <UnThemedQueryField
          theme={createTheme()}
          query="my query"
          onRichValueChange={mockOnRichValueChange}
          syntaxLoaded
          portalOrigin="mock-origin"
        />
      );
      await screen.findByText('my query');
      rerender(
        <UnThemedQueryField
          theme={createTheme()}
          query="my query"
          onRichValueChange={mockOnRichValueChange}
          syntaxLoaded
          portalOrigin="mock-origin"
        />
      );
      expect(mockOnRichValueChange).not.toBeCalled();

      // wait for the query to appear to prevent act warnings
      await screen.findByText('my query');
    });

    it('should not re-render the editor twice once syntax is fully loaded', async () => {
      const mockOnRichValueChange = jest.fn();
      const { rerender } = render(
        <UnThemedQueryField
          theme={createTheme()}
          onRichValueChange={mockOnRichValueChange}
          query="my query"
          portalOrigin="mock-origin"
        />
      );
      await screen.findByText('my query');
      rerender(
        <UnThemedQueryField
          theme={createTheme()}
          syntaxLoaded
          onRichValueChange={mockOnRichValueChange}
          query="my query"
          portalOrigin="mock-origin"
        />
      );
      rerender(
        <UnThemedQueryField
          theme={createTheme()}
          syntaxLoaded
          onRichValueChange={mockOnRichValueChange}
          query="my query"
          portalOrigin="mock-origin"
        />
      );
      expect(mockOnRichValueChange).toBeCalledTimes(1);

      // wait for the query to appear to prevent act warnings
      await screen.findByText('my query');
    });
  });
});
