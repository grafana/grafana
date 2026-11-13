import { render, screen } from 'test/test-utils';

import { setPluginComponentsHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import Home from './Home';
import { setGrafanaSearchRules } from './mocks/rulesSearch';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: () => ({ isAvailable: false, openAssistant: undefined }),
}));

setPluginComponentsHook(() => ({ components: [], isLoading: false }));
setupMswServer();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleRead]);
  setupDataSources();
  setGrafanaSearchRules([]);
});

describe('Home', () => {
  it('renders the revamped home page, without the old tabs', async () => {
    render(<Home />);

    expect(await screen.findByText('Set up alerting')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Get started' })).not.toBeInTheDocument();
  });
});
