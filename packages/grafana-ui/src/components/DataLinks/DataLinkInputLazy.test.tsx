import { render, screen } from '@testing-library/react';

import { DataLinkInput } from './DataLinkInputLazy';

let shouldThrowOnRender = false;

const mockDataLinkInput = jest.fn(({ value }: { value: string }) => {
  if (shouldThrowOnRender) {
    throw new Error('DataLinkInput render failure');
  }

  return <div data-testid="data-link-input">{value}</div>;
});

jest.mock('./DataLinkInput', () => ({
  __esModule: true,
  DataLinkInput: (props: { value: string }) => mockDataLinkInput(props),
}));

describe('DataLinkInput lazy wrapper', () => {
  beforeEach(() => {
    shouldThrowOnRender = false;
    mockDataLinkInput.mockClear();
  });

  it('shows a loading placeholder before rendering the input', async () => {
    render(<DataLinkInput value="https://grafana.com" onChange={jest.fn()} suggestions={[]} />);

    expect(screen.getByText('Loading input')).toBeInTheDocument();
    expect(await screen.findByTestId('data-link-input')).toHaveTextContent('https://grafana.com');
  });

  it('shows an error boundary fallback when the input render fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrowOnRender = true;

    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={[]} />);

    expect(await screen.findByText('Data link input failed to load')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
