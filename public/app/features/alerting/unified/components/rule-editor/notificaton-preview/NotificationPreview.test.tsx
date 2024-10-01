import { render, screen, waitFor, within, userEvent } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';

import 'core-js/stable/structured-clone';
import { MatcherOperator } from '../../../../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { mockApi, setupMswServer } from '../../../mockApi';
import { grantUserPermissions, mockAlertQuery } from '../../../mocks';
import { mockPreviewApiResponse } from '../../../mocks/grafanaRulerApi';
import * as dataSource from '../../../utils/datasource';
import {
  AlertManagerDataSource,
  GRAFANA_RULES_SOURCE_NAME,
  useGetAlertManagerDataSourcesByPermissionAndConfig,
} from '../../../utils/datasource';
import { Folder } from '../RuleFolderPicker';

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
  route: byTestId('matching-policy-route'),
  routeButton: byRole('button', { name: /Expand policy route/ }),
  routeMatchingInstances: byTestId('route-matching-instance'),
  loadingIndicator: byText(/Loading/),
  previewButton: byRole('button', { name: /preview routing/i }),
  grafanaAlertManagerLabel: byText(/alertmanager:grafana/i),
  otherAlertManagerLabel: byText(/alertmanager:other_am/i),
  seeDetails: byText(/see details/i),
  details: {
    title: byRole('heading', { name: /routing details/i }),
    modal: byRole('dialog'),
    linkToContactPoint: byRole('link', { name: /see details/i }),
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

function mockOneAlertManager() {
  getAlertManagerDataSourcesByPermissionAndConfigMock.mockReturnValue([grafanaAlertManagerDataSource]);
  mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
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
}

function mockTwoAlertManagers() {
  getAlertManagerDataSourcesByPermissionAndConfigMock.mockReturnValue([
    { name: 'OTHER_AM', imgUrl: '', hasConfigurationAPI: true },
    grafanaAlertManagerDataSource,
  ]);

  mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
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
  mockApi(server).getAlertmanagerConfig('OTHER_AM', (amConfigBuilder) =>
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
  it('should render notification preview without alert manager label, when having only one alert manager configured to receive alerts', async () => {
    mockOneAlertManager();
    mockPreviewApiResponse(server, [{ labels: [{ tomato: 'red', avocate: 'green' }] }]);

    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />);

    await userEvent.click(ui.previewButton.get());
    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    // we expect the alert manager label to be missing as there is only one alert manager configured to receive alerts
    await waitFor(() => {
      expect(ui.grafanaAlertManagerLabel.query()).not.toBeInTheDocument();
    });
    expect(ui.otherAlertManagerLabel.query()).not.toBeInTheDocument();

    const matchingPoliciesElements = ui.route.queryAll;
    await waitFor(() => {
      expect(matchingPoliciesElements()).toHaveLength(1);
    });
    expect(matchingPoliciesElements()[0]).toHaveTextContent(/tomato = red/);
  });
  it('should render notification preview with alert manager sections, when having more than one alert manager configured to receive alerts', async () => {
    // two alert managers configured  to receive alerts
    mockTwoAlertManagers();
    mockPreviewApiResponse(server, [{ labels: [{ tomato: 'red', avocate: 'green' }] }]);

    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />);
    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    await userEvent.click(ui.previewButton.get());
    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    // we expect the alert manager label to be present as there is more than one alert manager configured to receive alerts
    await waitFor(() => {
      expect(ui.grafanaAlertManagerLabel.query()).toBeInTheDocument();
    });
    expect(ui.otherAlertManagerLabel.query()).toBeInTheDocument();

    const matchingPoliciesElements = ui.route.queryAll();
    expect(matchingPoliciesElements).toHaveLength(2);
    expect(matchingPoliciesElements[0]).toHaveTextContent(/tomato = red/);
    expect(matchingPoliciesElements[1]).toHaveTextContent(/tomato = red/);
  });
  it('should render details modal when clicking see details button', async () => {
    // two alert managers configured  to receive alerts
    mockOneAlertManager();
    mockPreviewApiResponse(server, [{ labels: [{ tomato: 'red', avocate: 'green' }] }]);
    mockHasEditPermission(true);

    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />);
    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    await userEvent.click(ui.previewButton.get());
    await userEvent.click(await ui.seeDetails.find());
    expect(ui.details.title.query()).toBeInTheDocument();
    //we expect seeing the default policy
    expect(screen.getByText(/default policy/i)).toBeInTheDocument();
    const matchingPoliciesElements = within(ui.details.modal.get()).getAllByTestId('label-matchers');
    expect(matchingPoliciesElements).toHaveLength(1);
    expect(matchingPoliciesElements[0]).toHaveTextContent(/tomato = red/);
    expect(within(ui.details.modal.get()).getByText(/slack/i)).toBeInTheDocument();
    expect(ui.details.linkToContactPoint.get()).toBeInTheDocument();
  });
  it('should not render contact point link in details modal if user has no permissions for editing contact points', async () => {
    // two alert managers configured  to receive alerts
    mockOneAlertManager();
    mockPreviewApiResponse(server, [{ labels: [{ tomato: 'red', avocate: 'green' }] }]);
    mockHasEditPermission(false);

    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />);
    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    await userEvent.click(ui.previewButton.get());
    await userEvent.click(await ui.seeDetails.find());
    expect(ui.details.title.query()).toBeInTheDocument();
    //we expect seeing the default policy
    expect(screen.getByText(/default policy/i)).toBeInTheDocument();
    const matchingPoliciesElements = within(ui.details.modal.get()).getAllByTestId('label-matchers');
    expect(matchingPoliciesElements).toHaveLength(1);
    expect(matchingPoliciesElements[0]).toHaveTextContent(/tomato = red/);
    expect(within(ui.details.modal.get()).getByText(/slack/i)).toBeInTheDocument();
    expect(ui.details.linkToContactPoint.query()).not.toBeInTheDocument();
  });
});

describe('NotificationPreviewByAlertmanager', () => {
  it('should render route matching preview for alertmanager', async () => {
    const potentialInstances: Labels[] = [
      { foo: 'bar', severity: 'critical' },
      { job: 'prometheus', severity: 'warning' },
    ];

    mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
      amConfigBuilder
        .withRoute((routeBuilder) =>
          routeBuilder
            .withReceiver('email')
            .addRoute((rb) => rb.withReceiver('slack').addMatcher('severity', MatcherOperator.equal, 'critical'))
            .addRoute((rb) => rb.withReceiver('opsgenie').addMatcher('team', MatcherOperator.equal, 'operations'))
        )
        .addReceivers((b) => b.withName('email').addEmailConfig((eb) => eb.withTo('test@example.com')))
        .addReceivers((b) => b.withName('slack'))
        .addReceivers((b) => b.withName('opsgenie'))
    );

    const user = userEvent.setup();

    render(
      <NotificationPreviewByAlertManager
        alertManagerSource={grafanaAlertManagerDataSource}
        potentialInstances={potentialInstances}
        onlyOneAM={true}
      />
    );

    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    const routeElements = ui.route.getAll();

    expect(routeElements).toHaveLength(2);
    expect(routeElements[0]).toHaveTextContent(/slack/);
    expect(routeElements[1]).toHaveTextContent(/email/);

    await user.click(ui.routeButton.get(routeElements[0]));
    await user.click(ui.routeButton.get(routeElements[1]));

    const matchingInstances0 = ui.routeMatchingInstances.get(routeElements[0]);
    const matchingInstances1 = ui.routeMatchingInstances.get(routeElements[1]);

    expect(matchingInstances0).toHaveTextContent(/severity=critical/);
    expect(matchingInstances0).toHaveTextContent(/foo=bar/);

    expect(matchingInstances1).toHaveTextContent(/job=prometheus/);
    expect(matchingInstances1).toHaveTextContent(/severity=warning/);
  });
  it('should render route matching preview for alertmanager without errors if receiver is inherited from parent route (no receiver) ', async () => {
    const potentialInstances: Labels[] = [
      { foo: 'bar', severity: 'critical' },
      { job: 'prometheus', severity: 'warning' },
    ];

    mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
      amConfigBuilder
        .withRoute((routeBuilder) =>
          routeBuilder
            .withReceiver('email')
            .addRoute((rb) => {
              rb.addRoute((rb) => rb.withoutReceiver().addMatcher('foo', MatcherOperator.equal, 'bar'));
              return rb.withReceiver('slack').addMatcher('severity', MatcherOperator.equal, 'critical');
            })
            .addRoute((rb) => rb.withReceiver('opsgenie').addMatcher('team', MatcherOperator.equal, 'operations'))
        )
        .addReceivers((b) => b.withName('email').addEmailConfig((eb) => eb.withTo('test@example.com')))
        .addReceivers((b) => b.withName('slack'))
        .addReceivers((b) => b.withName('opsgenie'))
    );

    const user = userEvent.setup();

    render(
      <NotificationPreviewByAlertManager
        alertManagerSource={grafanaAlertManagerDataSource}
        potentialInstances={potentialInstances}
        onlyOneAM={true}
      />
    );

    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    const routeElements = ui.route.getAll();

    expect(routeElements).toHaveLength(2);
    expect(routeElements[0]).toHaveTextContent(/slack/);
    expect(routeElements[1]).toHaveTextContent(/email/);

    await user.click(ui.routeButton.get(routeElements[0]));
    await user.click(ui.routeButton.get(routeElements[1]));

    const matchingInstances0 = ui.routeMatchingInstances.get(routeElements[0]);
    const matchingInstances1 = ui.routeMatchingInstances.get(routeElements[1]);

    expect(matchingInstances0).toHaveTextContent(/severity=critical/);
    expect(matchingInstances0).toHaveTextContent(/foo=bar/);

    expect(matchingInstances1).toHaveTextContent(/job=prometheus/);
    expect(matchingInstances1).toHaveTextContent(/severity=warning/);
  });
  it('should render route matching preview for alertmanager without errors if receiver is inherited from parent route (empty string receiver)', async () => {
    const potentialInstances: Labels[] = [
      { foo: 'bar', severity: 'critical' },
      { job: 'prometheus', severity: 'warning' },
    ];

    mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
      amConfigBuilder
        .withRoute((routeBuilder) =>
          routeBuilder
            .withReceiver('email')
            .addRoute((rb) => {
              rb.addRoute((rb) => rb.withEmptyReceiver().addMatcher('foo', MatcherOperator.equal, 'bar'));
              return rb.withReceiver('slack').addMatcher('severity', MatcherOperator.equal, 'critical');
            })
            .addRoute((rb) => rb.withReceiver('opsgenie').addMatcher('team', MatcherOperator.equal, 'operations'))
        )
        .addReceivers((b) => b.withName('email').addEmailConfig((eb) => eb.withTo('test@example.com')))
        .addReceivers((b) => b.withName('slack'))
        .addReceivers((b) => b.withName('opsgenie'))
    );

    const user = userEvent.setup();

    render(
      <NotificationPreviewByAlertManager
        alertManagerSource={grafanaAlertManagerDataSource}
        potentialInstances={potentialInstances}
        onlyOneAM={true}
      />
    );

    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    const routeElements = ui.route.getAll();

    expect(routeElements).toHaveLength(2);
    expect(routeElements[0]).toHaveTextContent(/slack/);
    expect(routeElements[1]).toHaveTextContent(/email/);

    await user.click(ui.routeButton.get(routeElements[0]));
    await user.click(ui.routeButton.get(routeElements[1]));

    const matchingInstances0 = ui.routeMatchingInstances.get(routeElements[0]);
    const matchingInstances1 = ui.routeMatchingInstances.get(routeElements[1]);

    expect(matchingInstances0).toHaveTextContent(/severity=critical/);
    expect(matchingInstances0).toHaveTextContent(/foo=bar/);

    expect(matchingInstances1).toHaveTextContent(/job=prometheus/);
    expect(matchingInstances1).toHaveTextContent(/severity=warning/);
  });

  describe('regex matching', () => {
    it('does not match regex in middle of the word as alertmanager will anchor when queried via API', async () => {
      const potentialInstances: Labels[] = [{ regexfield: 'foobarfoo' }];

      mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
        amConfigBuilder
          .addReceivers((b) => b.withName('email'))
          .withRoute((routeBuilder) =>
            routeBuilder
              .withReceiver('email')
              .addRoute((rb) => rb.withReceiver('email').addMatcher('regexfield', MatcherOperator.regex, 'bar'))
          )
      );

      render(
        <NotificationPreviewByAlertManager
          alertManagerSource={grafanaAlertManagerDataSource}
          potentialInstances={potentialInstances}
          onlyOneAM={true}
        />
      );

      expect(await screen.findByText(/default policy/i)).toBeInTheDocument();
      expect(screen.queryByText(/regexfield/)).not.toBeInTheDocument();
    });

    it('matches regex at the start of the word', async () => {
      const potentialInstances: Labels[] = [{ regexfield: 'baaaaaaah' }];

      mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
        amConfigBuilder
          .addReceivers((b) => b.withName('email'))
          .withRoute((routeBuilder) =>
            routeBuilder
              .withReceiver('email')
              .addRoute((rb) => rb.withReceiver('email').addMatcher('regexfield', MatcherOperator.regex, 'ba.*h'))
          )
      );

      render(
        <NotificationPreviewByAlertManager
          alertManagerSource={grafanaAlertManagerDataSource}
          potentialInstances={potentialInstances}
          onlyOneAM={true}
        />
      );

      expect(await screen.findByText(/regexfield/i)).toBeInTheDocument();
    });

    it('handles negated regex correctly', async () => {
      const potentialInstances: Labels[] = [{ regexfield: 'thing' }];

      mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
        amConfigBuilder
          .addReceivers((b) => b.withName('email'))
          .withRoute((routeBuilder) =>
            routeBuilder
              .withReceiver('email')
              .addRoute((rb) => rb.withReceiver('email').addMatcher('regexfield', MatcherOperator.notRegex, 'thing'))
          )
      );

      render(
        <NotificationPreviewByAlertManager
          alertManagerSource={grafanaAlertManagerDataSource}
          potentialInstances={potentialInstances}
          onlyOneAM={true}
        />
      );

      expect(await screen.findByText(/default policy/i)).toBeInTheDocument();
      expect(screen.queryByText(/regexfield/i)).not.toBeInTheDocument();
    });
  });
});
