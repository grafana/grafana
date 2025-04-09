import { Route, Routes } from 'react-router-dom-v5-compat';
import { ui } from 'test/helpers/alertingRuleEditor';
import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { setFolderResponse } from 'app/features/alerting/unified/mocks/server/configure';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockDataSource, mockFolder } from '../mocks';
import { grafanaRulerRule } from '../mocks/grafanaRulerApi';
import { MIMIR_DATASOURCE_UID } from '../mocks/server/constants';
import { setupDataSources } from '../testSetup/datasources';
import { Annotation } from '../utils/constants';

import RuleEditor from './RuleEditor';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

setupMswServer();

function renderRuleEditor(identifier: string) {
  return render(
    <Routes>
      <Route path="/alerting/:id/edit" element={<RuleEditor />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/alerting/${identifier}/edit`] },
    }
  );
}

describe('RuleEditor grafana managed rules', () => {
  const folder = {
    title: 'Folder A',
    uid: grafanaRulerRule.grafana_alert.namespace_uid,
    id: 1,
    type: DashboardSearchItemType.DashDB,
    accessControl: {
      [AccessControlAction.AlertingRuleUpdate]: true,
    },
  };

  const slashedFolder = {
    title: 'Folder with /',
    uid: 'abcde',
    id: 2,
    accessControl: {
      [AccessControlAction.AlertingRuleUpdate]: true,
    },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;

    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.DataSourcesRead,
      AccessControlAction.DataSourcesWrite,
      AccessControlAction.DataSourcesCreate,
      AccessControlAction.FoldersWrite,
      AccessControlAction.FoldersRead,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);

    const dataSources = {
      default: mockDataSource({
        uid: MIMIR_DATASOURCE_UID,
        type: 'prometheus',
        name: 'Mimir',
        isDefault: true,
      }),
    };
    setupDataSources(dataSources.default);
    setFolderResponse(mockFolder(folder));
    setFolderResponse(mockFolder(slashedFolder));
  });

  it('can edit grafana managed rule', async () => {
    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);

    // check that it's filled in
    const nameInput = await ui.inputs.name.find();
    expect(nameInput).toHaveValue(grafanaRulerRule.grafana_alert.title);
    //check that folder is in the list
    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
    expect(ui.inputs.annotationValue(0).get()).toHaveValue(grafanaRulerRule.annotations[Annotation.summary]);
    expect(screen.getByText('New folder')).toBeInTheDocument();

    //check that slashed folders are not in the list
    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
    expect(ui.inputs.folder.get()).not.toHaveTextContent(new RegExp(slashedFolder.title));

    // add an annotation
    await user.click(screen.getByText('Add custom annotation'));
    await user.type(screen.getByPlaceholderText('Enter custom annotation name...'), 'custom');
    await user.type(screen.getByPlaceholderText('Enter custom annotation content...'), 'value');

    // save and check what was sent to backend
    await user.click(ui.buttons.save.get());
  });

  it('saves evaluation interval correctly', async () => {
    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);

    await user.click(await screen.findByRole('button', { name: /new evaluation group/i }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText(/evaluation group name/i), 'new group');
    const evalInterval = screen.getByLabelText(/^evaluation interval/i);

    await user.clear(evalInterval);
    await user.type(evalInterval, '12m');
    await user.click(screen.getByRole('button', { name: /create/i }));

    // Update the pending period as well, otherwise we'll get a form validation error
    // and the rule won't try and save
    await user.type(screen.getByLabelText(/pending period/i), '12m');

    const capture = captureRequests(
      (req) => req.method === 'POST' && req.url.includes('/api/ruler/grafana/api/v1/rules/uuid020c61ef')
    );

    await user.click(ui.buttons.save.get());

    const [request] = await capture;
    const postBody = await request.json();

    expect(postBody.name).toBe('new group');
    expect(postBody.interval).toBe('12m');
  });
});

describe('Data source managed rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleExternalWrite]);
  });

  it('should show an error if the data source does not exist', async () => {
    renderRuleEditor('cri%24grafana-cloudd%24delete me%24delete me 3%24recording_rule_delete_2%24-476183141');
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});
