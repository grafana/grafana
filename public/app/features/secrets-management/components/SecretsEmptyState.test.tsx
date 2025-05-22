import { render, screen, userEvent } from 'test/test-utils';

import { SecretsEmptyState } from './SecretsEmptyState';

const handleCreateSecret = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

describe('SecretsEmptyState', () => {
  it('should have a create button', async () => {
    render(<SecretsEmptyState onCreateSecret={handleCreateSecret} />);
    const createButton = screen.getByText(/create secret/i);
    expect(createButton).toBeInTheDocument();
    await userEvent.click(createButton);
    expect(handleCreateSecret).toHaveBeenCalledTimes(1);
  });
});
