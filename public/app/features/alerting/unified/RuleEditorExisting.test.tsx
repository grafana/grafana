import { Route } from 'react-router-dom';
import { ui } from 'test/helpers/alertingRuleEditor';
import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';

import { searchFolders } from '../../../../app/features/manage-dashboards/state/actions';
import { backendSrv } from '../../../core/services/backend_srv';
import { AccessControlAction } from '../../../types';

import RuleEditor from './RuleEditor';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { setupMswServer } from './mockApi';
import { grantUserPermissions, mockDataSource, mockFolder } from './mocks';
import { grafanaRulerRule } from './mocks/grafanaRulerApi';
import { setupDataSources } from './testSetup/datasources';
import { Annotation } from './utils/constants';

jest.mock('./components/rule-editor/ExpressionEditor', () => ({
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.mock('../../../../app/features/manage-dashboards/state/actions');

// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  QueryEditorRow: () => <p>hi</p>,
}));

jest.setTimeout(60 * 1000);

const mocks = {
  searchFolders: jest.mocked(searchFolders),
};

setupMswServer();

function renderRuleEditor(identifier?: string) {
  return render(<Route path={['/alerting/new', '/alerting/:id/edit']} component={RuleEditor} />, {
    historyOptions: { initialEntries: [identifier ? `/alerting/${identifier}/edit` : `/alerting/new`] },
  });
}

describe('RuleEditor grafana managed rules', () => {
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
  });

  it('can edit grafana managed rule', async () => {
    const folder = {
      title: 'Folder A',
      uid: grafanaRulerRule.grafana_alert.namespace_uid,
      id: 1,
      type: DashboardSearchItemType.DashDB,
    };

    const slashedFolder = {
      title: 'Folder with /',
      uid: 'abcde',
      id: 2,
    };

    const dataSources = {
      default: mockDataSource(
        {
          type: 'prometheus',
          name: 'Prom',
          isDefault: true,
        },
        { alerting: false }
      ),
    };

    jest.spyOn(backendSrv, 'getFolderByUid').mockResolvedValue({
      ...mockFolder(),
      accessControl: {
        [AccessControlAction.AlertingRuleUpdate]: true,
      },
    });

    setupDataSources(dataSources.default);

    // mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
    mocks.searchFolders.mockResolvedValue([folder, slashedFolder] as DashboardSearchHit[]);

    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);

    // check that it's filled in
    const nameInput = await ui.inputs.name.find();
    expect(nameInput).toHaveValue(grafanaRulerRule.grafana_alert.title);
    //check that folder is in the list
    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
    expect(ui.inputs.annotationValue(0).get()).toHaveValue(grafanaRulerRule.annotations[Annotation.summary]);

    //check that slashed folders are not in the list
    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
    expect(ui.inputs.folder.get()).not.toHaveTextContent(new RegExp(slashedFolder.title));

    //check that slashes warning is only shown once user search slashes
    //todo: move this test to a unit test in FolderAndGroup unit test
    // const folderInput = await ui.inputs.folderContainer.find();
    // expect(within(folderInput).queryByText("Folders with '/' character are not allowed.")).not.toBeInTheDocument();
    // await user.type(within(folderInput).getByRole('combobox'), 'new slashed //');
    // expect(within(folderInput).getByText("Folders with '/' character are not allowed.")).toBeInTheDocument();
    // await user.keyboard('{backspace} {backspace}{backspace}');
    // expect(within(folderInput).queryByText("Folders with '/' character are not allowed.")).not.toBeInTheDocument();

    // add an annotation
    await user.click(screen.getByText('Add custom annotation'));
    await user.type(screen.getByPlaceholderText('Enter custom annotation name...'), 'custom');
    await user.type(screen.getByPlaceholderText('Enter custom annotation content...'), 'value');

    // save and check what was sent to backend
    await user.click(ui.buttons.save.get());

    mocks.searchFolders.mockResolvedValue([] as DashboardSearchHit[]);
    expect(screen.getByText('New folder')).toBeInTheDocument();
  });
});
