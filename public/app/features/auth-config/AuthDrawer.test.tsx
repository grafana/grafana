import { render, screen } from '@testing-library/react';
import React from 'react';

import { AuthDrawer, Props } from './AuthDrawer';

const defaultProps: Props = {
  onClose: jest.fn(),
};

async function getTestContext(overrides: Partial<Props> = {}) {
  jest.clearAllMocks();

  const props = { ...defaultProps, ...overrides };
  const { rerender } = render(<AuthDrawer {...props} />);

  return { rerender, props };
}

it('should render with default props', async () => {
  await getTestContext({});
  expect(screen.getByText(/Enable insecure email lookup/i)).toBeInTheDocument();
});
