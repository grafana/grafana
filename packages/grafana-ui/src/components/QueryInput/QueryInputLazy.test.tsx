import { render, screen } from '@testing-library/react';

import { QueryInput } from './QueryInputLazy';

let shouldThrowOnRender = false;

const mockQueryInput = jest.fn(({ value }: { value: string }) => {
  if (shouldThrowOnRender) {
    throw new Error('QueryInput render failure');
  }

  return <div data-testid="query-input">{value}</div>;
});

jest.mock('./QueryInput', () => ({
  __esModule: true,
  QueryInput: (props: { value: string }) => mockQueryInput(props),
}));

describe('QueryInput lazy wrapper', () => {
  beforeEach(() => {
    shouldThrowOnRender = false;
    mockQueryInput.mockClear();
  });

  it('shows a loading placeholder before rendering the input', async () => {
    render(<QueryInput value="my.query" onChange={jest.fn()} />);

    expect(screen.getByText('Loading input')).toBeInTheDocument();
    expect(await screen.findByTestId('query-input')).toHaveTextContent('my.query');
  });

  it('shows an error boundary fallback when the input render fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrowOnRender = true;

    render(<QueryInput value="" onChange={jest.fn()} />);

    expect(await screen.findByText('Query input failed to load')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
