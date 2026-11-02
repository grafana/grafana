import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { FOLDER_PARENTS_URL, getRecordingRuleHandler } from '../mocks/handlers';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';

const RECORDING_RULE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/recordingrules/:name`;

const server = setupMswServer();

describe('RecordingRuleListEntry', () => {
  beforeEach(() => {
    // Provide a default no-badge rule so requests don't go unhandled in tests that don't care about badges.
    server.use(getRecordingRuleHandler());
  });

  it('shows the folder path from the folder parents lookup, root first', async () => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-1', title: 'Team Metrics' },
          ],
        })
      )
    );

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m', folderUid: 'folder-1' }} />
      </ul>
    );

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Platform').compareDocumentPosition(screen.getByText('Team Metrics'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('shows the provisioning badge after the full rule loads with provenance set', async () => {
    server.use(
      getRecordingRuleHandler([
        {
          apiVersion: `${API_GROUP}/${API_VERSION}`,
          kind: 'RecordingRule',
          metadata: {
            name: 'rule-1',
            annotations: { 'grafana.com/provenance': 'terraform' },
          },
          spec: {
            title: 'cpu:usage:rate5m',
            metric: 'cpu:usage:rate5m',
            targetDatasourceUID: 'gdev-prometheus',
            trigger: { interval: '1m' },
            expressions: {},
          },
        },
      ])
    );

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m' }} />
      </ul>
    );

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no badge when the full rule fetch fails', async () => {
    server.use(
      http.get(RECORDING_RULE_URL, () =>
        HttpResponse.json({ kind: 'Status', status: 'Failure', code: 500 }, { status: 500 })
      )
    );

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m' }} />
      </ul>
    );

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows no badge when the full rule has no provenance and no plugin origin', async () => {
    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m' }} />
      </ul>
    );

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
