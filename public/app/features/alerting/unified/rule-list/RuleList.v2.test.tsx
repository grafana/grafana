import { http } from 'msw';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertingFactory } from '../mocks/server/db';
import { paginatedHandlerFor } from '../mocks/server/utils';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

const server = setupMswServer();

const mimirGroups = alertingFactory.group.buildList(5000, { file: 'test-mimir-namespace' });
alertingFactory.group.rewindSequence();
const prometheusGroups = alertingFactory.group.buildList(200, { file: 'test-prometheus-namespace' });

const mimirDs = alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
const prometheusDs = alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

beforeEach(() => {
  server.use(http.get(`/api/prometheus/${mimirDs.uid}/api/v1/rules`, paginatedHandlerFor(mimirGroups)));
  server.use(http.get(`/api/prometheus/${prometheusDs.uid}/api/v1/rules`, paginatedHandlerFor(prometheusGroups)));
});

// @TODO: Add tests for RuleList.v2
