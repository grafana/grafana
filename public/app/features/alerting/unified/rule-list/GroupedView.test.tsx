import { http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setPluginComponentsHook, setPluginLinksHook, setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertingFactory } from '../mocks/server/db';
import { paginatedHandlerFor } from '../mocks/server/utils';

import { GroupedView } from './GroupedView';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));
setReturnToPreviousHook(() => () => {});

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

const server = setupMswServer();

const mimirGroups = alertingFactory.group.buildList(2000, { file: 'test-mimir-namespace' });
alertingFactory.group.rewindSequence();
const prometheusGroups = alertingFactory.group.buildList(200, { file: 'test-prometheus-namespace' });

const mimirDs = alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
const prometheusDs = alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

beforeEach(() => {
  server.use(http.get(`/api/prometheus/${mimirDs.uid}/api/v1/rules`, paginatedHandlerFor(mimirGroups)));
  server.use(http.get(`/api/prometheus/${prometheusDs.uid}/api/v1/rules`, paginatedHandlerFor(prometheusGroups)));
});

describe('RuleList - GroupedView', () => {
  it('should render datasource sections', async () => {
    render(<GroupedView />);

    const mimirSection = await screen.findByRole('listitem', { name: /Mimir/ });
    const prometheusSection = await screen.findByRole('listitem', { name: /Prometheus/ });

    expect(mimirSection).toBeInTheDocument();
    expect(prometheusSection).toBeInTheDocument();
  });
});
