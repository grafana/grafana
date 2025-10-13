import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { defaultDashboard } from '@grafana/schema';

import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import AddPanelButton, { Props } from './AddPanelButton';
jest.mock('./AddPanelMenu', () => ({
  ...jest.requireActual('./AddPanelMenu'),
  __esModule: true,
  default: () => <div>Menu</div>,
}));

function setup(options?: Partial<Props>) {
  const props = {
    dashboard: createDashboardModelFixture(defaultDashboard),
  };
  const { rerender } = render(<AddPanelButton dashboard={props.dashboard} />);

  return rerender;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders button', () => {
  setup();

  expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
});

it('renders button without menu when menu is not open', () => {
  setup();

  expect(screen.queryByText('Menu')).not.toBeInTheDocument();
});

it('renders button with menu when menu is open', async () => {
  const user = userEvent.setup();
  setup();

  await user.click(screen.getByRole('button', { name: 'Add' }));

  expect(screen.queryByText('Menu')).toBeInTheDocument();
});
