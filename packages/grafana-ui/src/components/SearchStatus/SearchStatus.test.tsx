import { act, render, screen } from '@testing-library/react';

import { SearchStatus } from './SearchStatus';

describe('SearchStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a polite live region', () => {
    render(<SearchStatus message="5 results found" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('stays empty until the debounce elapses, so the announcement is a text change and not mount-time content', () => {
    render(<SearchStatus message="5 results found" />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('5 results found');
  });

  it('announces the new message when it changes', () => {
    const { rerender } = render(<SearchStatus message="5 results found" />);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByRole('status')).toHaveTextContent('5 results found');

    rerender(<SearchStatus message="No results found" />);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByRole('status')).toHaveTextContent('No results found');
  });
});
