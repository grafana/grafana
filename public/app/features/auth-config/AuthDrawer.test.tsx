import { render, screen } from 'test/test-utils';

import { AuthDrawerUnconnected, Props } from './AuthDrawer';

const defaultProps: Props = {
  onClose: jest.fn(),
  allowInsecureEmail: false,
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
};

async function getTestContext(overrides: Partial<Props> = {}) {
  jest.clearAllMocks();

  const props = { ...defaultProps, ...overrides };
  const { rerender } = render(<AuthDrawerUnconnected {...props} />);

  return { rerender, props };
}

it('should render with default props', async () => {
  await getTestContext({});
  expect(screen.getByText(/Enable insecure email lookup/i)).toBeInTheDocument();
});
