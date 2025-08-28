import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { setAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { AccessControlAction } from 'app/types/accessControl';

import { MatcherOperator } from '../../../../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { getMockConfig, setupMswServer } from '../../../mockApi';
import { grantUserPermissions, mockAlertQuery, mockAlertmanagerAlert } from '../../../mocks';
import { mockPreviewApiResponse } from '../../../mocks/grafanaRulerApi';
import { Folder } from '../../../types/rule-form';
import * as dataSource from '../../../utils/datasource';
import {
  AlertManagerDataSource,
  GRAFANA_RULES_SOURCE_NAME,
  useGetAlertManagerDataSourcesByPermissionAndConfig,
} from '../../../utils/datasource';

import { NotificationPreview } from './NotificationPreview';
import NotificationPreviewByAlertManager from './NotificationPreviewByAlertManager';

jest.mock('../../../useRouteGroupsMatcher');

jest
  .spyOn(dataSource, 'useGetAlertManagerDataSourcesByPermissionAndConfig')
  .mockReturnValue([{ name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true }]);

jest.spyOn(dataSource, 'getDatasourceAPIUid').mockImplementation((ds: string) => ds);

const getAlertManagerDataSourcesByPermissionAndConfigMock =
  useGetAlertManagerDataSourcesByPermissionAndConfig as jest.MockedFunction<
    typeof useGetAlertManagerDataSourcesByPermissionAndConfig
  >;

const ui = {
  contactPointGroup: byRole('list'),
  routeButton: byRole('button', { name: /Expand policy route/ }),
  routeMatchingInstances: byTestId('route-matching-instance'),
  loadingIndicator: byText(/Loading routing preview/i),
  previewButton: byRole('button', { name: /preview routing/i }),
  grafanaAlertManagerLabel: byText(/alertmanager:grafana/i),
  otherAlertManagerLabel: byText(/alertmanager:other_am/i),
  expandButton: byRole('button', { name: 'Expand policy route' }),
  seeDetails: byRole('button', { name: 'View route' }),
  details: {
    drawer: byRole('dialog'),
    linkToPolicyTree: byRole('link', { name: /view notification policy tree/i }),
  },
};

const server = setupMswServer();

beforeEach(() => {
  jest.clearAllMocks();
});

const alertQuery = mockAlertQuery({ datasourceUid: 'whatever', refId: 'A' });

const grafanaAlertManagerDataSource: AlertManagerDataSource = {
  name: GRAFANA_RULES_SOURCE_NAME,
  imgUrl: '',
  hasConfigurationAPI: true,
};

const mockConfig = getMockConfig((amConfigBuilder) =>
  amConfigBuilder
    .withRoute((routeBuilder) =>
      routeBuilder
        .withReceiver('email')
        .addRoute((rb) => rb.withReceiver('slack').addMatcher('tomato', MatcherOperator.equal, 'red'))
        .addRoute((rb) => rb.withReceiver('opsgenie').addMatcher('team', MatcherOperator.equal, 'operations'))
    )
    .addReceivers((b) => b.withName('email').addEmailConfig((eb) => eb.withTo('test@example.com')))
    .addReceivers((b) => b.withName('slack'))
    .addReceivers((b) => b.withName('opsgenie'))
);

function mockOneAlertManager() {
  getAlertManagerDataSourcesByPermissionAndConfigMock.mockReturnValue([grafanaAlertManagerDataSource]);

  setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);
}

function mockTwoAlertManagers() {
  getAlertManagerDataSourcesByPermissionAndConfigMock.mockReturnValue([
    grafanaAlertManagerDataSource,
    { name: 'OTHER_AM', imgUrl: '', hasConfigurationAPI: true },
  ]);

  setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);
  setAlertmanagerConfig('OTHER_AM', mockConfig);
}

function mockHasEditPermission(enabled: boolean) {
  const onlyReadPermissions = [
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsExternalRead,
  ];

  const readAndWritePermissions = [
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsWrite,
    AccessControlAction.AlertingNotificationsExternalRead,
    AccessControlAction.AlertingNotificationsExternalWrite,
  ];

  return enabled ? grantUserPermissions(readAndWritePermissions) : grantUserPermissions(onlyReadPermissions);
}

const folder: Folder = {
  uid: '1',
  title: 'title',
};

describe('NotificationPreview', () => {
  jest.retryTimes(2);

  it('should render notification preview without alert manager label, when having only one alert manager configured to receive alerts', async () => {
    mockOneAlertManager();
    mockPreviewApiResponse(server, [
      mockAlertmanagerAlert({
        labels: { tomato: 'red', avocate: 'green' },
      }),
    ]);

    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />);

    // wait for loading to finish
    await waitFor(async () => {
      const matchingContactPoint = await ui.contactPointGroup.findAll();
      expect(matchingContactPoint).toHaveLength(1);
    });

    // we expect the alert manager label to be missing as there is only one alert manager configured to receive alerts
    expect(ui.grafanaAlertManagerLabel.query()).not.toBeInTheDocument();
    expect(ui.otherAlertManagerLabel.query()).not.toBeInTheDocument();

    const matchingContactPoint = await ui.contactPointGroup.findAll();
    expect(matchingContactPoint[0]).toHaveTextContent(/Delivered to slack/);
    expect(matchingContactPoint[0]).toHaveTextContent(/1 instance/);
  });

  it('should render notification preview with alert manager sections, when having more than one alert manager configured to receive alerts', async () => {
    // two alert managers configured  to receive alerts
    mockTwoAlertManagers();
    mockPreviewApiResponse(server, [
      mockAlertmanagerAlert({
        labels: { tomato: 'red', avocate: 'green' },
      }),
    ]);

    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />);

    // wait for loading to finish
    await waitFor(async () => {
      const matchingContactPoint = await ui.contactPointGroup.findAll();
      expect(matchingContactPoint).toHaveLength(2);
    });

    // we expect the alert manager label to be present as there is more than one alert manager configured to receive alerts
    expect(await ui.grafanaAlertManagerLabel.find()).toBeInTheDocument();
    expect(await ui.otherAlertManagerLabel.find()).toBeInTheDocument();

    const matchingContactPoint = await ui.contactPointGroup.findAll();

    expect(matchingContactPoint).toHaveLength(2);
    expect(matchingContactPoint[0]).toHaveTextContent(/Delivered to slack/);
    expect(matchingContactPoint[0]).toHaveTextContent(/1 instance/);

    expect(matchingContactPoint[1]).toHaveTextContent(/Delivered to slack/);
    expect(matchingContactPoint[1]).toHaveTextContent(/1 instance/);
  });

  it('should render details when clicking see details button', async () => {
    mockHasEditPermission(true);
    mockOneAlertManager();
    mockPreviewApiResponse(server, [
      mockAlertmanagerAlert({
        labels: { tomato: 'red', avocate: 'green' },
      }),
    ]);

    const { user } = render(
      <NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />
    );
    // wait for loading to finish
    await waitFor(async () => {
      const matchingContactPoint = await ui.contactPointGroup.findAll();
      expect(matchingContactPoint).toHaveLength(1);
    });

    // expand the matching contact point to show instances
    await user.click(await ui.expandButton.find());

    // click "view route"
    await user.click(await ui.seeDetails.find());

    // grab drawer and assert within
    const drawer = ui.details.drawer.getAll()[0];
    expect(drawer).toBeInTheDocument();

    // assert within the drawer
    expect(within(drawer).getByRole('heading', { name: 'Default policy' })).toBeInTheDocument();
    expect(within(drawer).getByText(/non-matching labels/i)).toBeInTheDocument();
    expect(ui.details.linkToPolicyTree.get()).toBeInTheDocument();
  });
});
