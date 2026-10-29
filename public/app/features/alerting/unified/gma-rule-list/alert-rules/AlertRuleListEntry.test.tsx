import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { FOLDER_PARENTS_URL, getAlertRuleHandler, mockK8sAlertRule } from '../mocks/handlers';

import { AlertRuleListEntry } from './AlertRuleListEntry';

const ALERT_RULE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/alertrules/:name`;

const server = setupMswServer();

describe('AlertRuleListEntry', () => {
  it('shows the folder path from the folder parents lookup, root first', async () => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-1', title: 'Team Alerts' },
          ],
        })
      )
    );

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1' }} showFolderPath />
      </ul>
    );

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Platform').compareDocumentPosition(screen.getByText('Team Alerts'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('looks up no folder path when the folder row already shows it', async () => {
    let parentLookups = 0;
    server.use(
      http.get(FOLDER_PARENTS_URL, () => {
        parentLookups += 1;
        return HttpResponse.json({ items: [{ name: 'folder-1', title: 'Team Alerts' }] });
      })
    );

    render(
      <ul>
        <AlertRuleListEntry
          searchHit={{ uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1' }}
          showFolderPath={false}
        />
      </ul>
    );

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
    expect(parentLookups).toBe(0);
  });

  it('shows the provisioning badge after the full rule loads with provenance set', async () => {
    server.use(
      getAlertRuleHandler([
        {
          ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
          metadata: {
            name: 'rule-1',
            annotations: { 'grafana.com/provenance': 'terraform' },
          },
        },
      ])
    );

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high' }} showFolderPath />
      </ul>
    );

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no badge when the full rule fetch fails', async () => {
    server.use(
      http.get(ALERT_RULE_URL, () =>
        HttpResponse.json({ kind: 'Status', status: 'Failure', code: 500 }, { status: 500 })
      )
    );

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high' }} showFolderPath />
      </ul>
    );

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows no badge when the full rule has no provenance and no plugin origin', async () => {
    server.use(getAlertRuleHandler([mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' })]));

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high' }} showFolderPath />
      </ul>
    );

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
