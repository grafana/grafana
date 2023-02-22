import { render } from '@testing-library/react';
import React from 'react';

import { createTheme } from '@grafana/data';

import { UnThemedQueryField } from './QueryField';

describe('<QueryField />', () => {
  it('should render with null initial value', () => {
    expect(() =>
      render(
        <UnThemedQueryField theme={createTheme()} query={null} onTypeahead={jest.fn()} portalOrigin="mock-origin" />
      )
    ).not.toThrow();
  });

  it('should render with empty initial value', () => {
    expect(() =>
      render(<UnThemedQueryField theme={createTheme()} query="" onTypeahead={jest.fn()} portalOrigin="mock-origin" />)
    ).not.toThrow();
  });

  it('should render with initial value', () => {
    expect(() =>
      render(
        <UnThemedQueryField theme={createTheme()} query="my query" onTypeahead={jest.fn()} portalOrigin="mock-origin" />
      )
    ).not.toThrow();
  });

  describe('syntaxLoaded', () => {
    it('should re-render the editor after syntax has fully loaded', () => {
      const mockOnRichValueChange = jest.fn();
      const { rerender } = render(
        <UnThemedQueryField
          theme={createTheme()}
          query="my query"
          onRichValueChange={mockOnRichValueChange}
          portalOrigin="mock-origin"
        />
      );
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
    });

    it('should not re-render the editor if syntax is already loaded', () => {
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
    });

    it('should not re-render the editor twice once syntax is fully loaded', () => {
      const mockOnRichValueChange = jest.fn();
      const { rerender } = render(
        <UnThemedQueryField
          theme={createTheme()}
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
    });
  });
});
