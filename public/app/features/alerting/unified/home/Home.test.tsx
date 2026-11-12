import { cleanup, render, screen } from 'test/test-utils';

import { setPluginComponentsHook } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import Home from './Home';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: () => ({ isAvailable: false, openAssistant: undefined }),
}));

setPluginComponentsHook(() => ({ components: [], isLoading: false }));
setupMswServer();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleRead]);
  setupDataSources();
});

afterEach(() => {
  // Unmount before resetting flags, so flag hooks are not notified outside act()
  cleanup();
  setTestFlags();
});

describe('Home', () => {
  it('renders the revamped home page, without the old tabs, even with the revamped home flag off', async () => {
    setTestFlags({ [FlagKeys.AlertingRevampedHomeExperience]: false });

    render(<Home />);

    expect(await screen.findByText('Set up alerting')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Get started' })).not.toBeInTheDocument();
  });
});
