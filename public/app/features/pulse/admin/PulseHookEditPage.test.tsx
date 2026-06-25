import { render, screen, userEvent } from 'test/test-utils';

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: () => ({}),
}));

import PulseHookEditPage from './PulseHookEditPage';

describe('PulseHookEditPage (create)', () => {
  it('renders the create form', () => {
    render(<PulseHookEditPage />);
    expect(screen.getByText('Hook settings')).toBeInTheDocument();
  });

  // Regression: the onChange handlers used to read `e.currentTarget.value`
  // inside the setState updater, which runs after React has nullified the
  // synthetic event — typing crashed with "Cannot read properties of null".
  it('lets the user type into the name and url fields without crashing', async () => {
    const user = userEvent.setup();
    render(<PulseHookEditPage />);

    const name = screen.getByLabelText(/name/i);
    await user.type(name, 'my-hook');
    expect(name).toHaveValue('my-hook');

    const url = screen.getByLabelText(/url/i);
    await user.type(url, 'https://example.com/hook');
    expect(url).toHaveValue('https://example.com/hook');
  });
});
