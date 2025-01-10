import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { setAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { testWithFeatureToggles } from 'app/features/alerting/unified/test/test-utils';
import { AccessControlAction } from 'app/types/accessControl';

import { MatcherOperator } from '../../../../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { getMockConfig, setupMswServer } from '../../../mockApi';
import { grantUserPermissions, mockAlertQuery } from '../../../mocks';
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
  route: byTestId('matching-policy-route'),
  routeButton: byRole('button', { name: /Expand policy route/ }),
  routeMatchingInstances: byTestId('route-matching-instance'),
  loadingIndicator: byText(/Loading routing preview/i),
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

describe.each([
  // k8s API enabled
  true,
  // k8s API disabled
  false,
])('NotificationPreview with alertingApiServer=%p', (apiServerEnabled) => {
  apiServerEnabled ? testWithFeatureToggles(['alertingApiServer']) : testWithFeatureToggles([]);
  jest.retryTimes(2);

  it('should render notification preview without alert manager label, when having only one alert manager configured to receive alerts', async () => {
    mockOneAlertManager();
    mockPreviewApiResponse(server, [{ labels: [{ tomato: 'red', avocate: 'green' }] }]);

    const { user } = render(
      <NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />
    );

    await user.click(ui.previewButton.get());
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

    const { user } = render(
      <NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />
    );

    await user.click(await ui.previewButton.find());

    // we expect the alert manager label to be present as there is more than one alert manager configured to receive alerts
    expect(await ui.grafanaAlertManagerLabel.find()).toBeInTheDocument();
    expect(await ui.otherAlertManagerLabel.find()).toBeInTheDocument();

    const matchingPoliciesElements = await ui.route.findAll();

    expect(matchingPoliciesElements).toHaveLength(2);
    expect(matchingPoliciesElements[0]).toHaveTextContent(/tomato = red/);
    expect(matchingPoliciesElements[1]).toHaveTextContent(/tomato = red/);
  });
  it('should render details modal when clicking see details button', async () => {
    // two alert managers configured  to receive alerts
    mockOneAlertManager();
    mockPreviewApiResponse(server, [{ labels: [{ tomato: 'red', avocate: 'green' }] }]);
    mockHasEditPermission(true);

    const { user } = render(
      <NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />
    );
    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    await user.click(ui.previewButton.get());
    await user.click(await ui.seeDetails.find());
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

    const { user } = render(
      <NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="A" folder={folder} />
    );
    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    await user.click(ui.previewButton.get());
    await user.click(await ui.seeDetails.find());
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

    const mockConfig = getMockConfig((amConfigBuilder) =>
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
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);

    const { user } = render(
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

    const mockConfig = getMockConfig((amConfigBuilder) =>
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
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);

    const { user } = render(
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

    const mockConfig = getMockConfig((amConfigBuilder) =>
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

    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);

    const { user } = render(
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

      const mockConfig = getMockConfig((amConfigBuilder) =>
        amConfigBuilder
          .addReceivers((b) => b.withName('email'))
          .withRoute((routeBuilder) =>
            routeBuilder
              .withReceiver('email')
              .addRoute((rb) => rb.withReceiver('email').addMatcher('regexfield', MatcherOperator.regex, 'bar'))
          )
      );

      setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);

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

      const mockConfig = getMockConfig((amConfigBuilder) =>
        amConfigBuilder
          .addReceivers((b) => b.withName('email'))
          .withRoute((routeBuilder) =>
            routeBuilder
              .withReceiver('email')
              .addRoute((rb) => rb.withReceiver('email').addMatcher('regexfield', MatcherOperator.regex, 'ba.*h'))
          )
      );
      setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);

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

      const mockConfig = getMockConfig((amConfigBuilder) =>
        amConfigBuilder
          .addReceivers((b) => b.withName('email'))
          .withRoute((routeBuilder) =>
            routeBuilder
              .withReceiver('email')
              .addRoute((rb) => rb.withReceiver('email').addMatcher('regexfield', MatcherOperator.notRegex, 'thing'))
          )
      );
      setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);

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
  it('matches regex with flags', async () => {
    const potentialInstances: Labels[] = [{ regexfield: 'baaaaaaah' }];

    const mockConfig = getMockConfig((amConfigBuilder) =>
      amConfigBuilder
        .addReceivers((b) => b.withName('email'))
        .withRoute((routeBuilder) =>
          routeBuilder
            .withReceiver('email')
            .addRoute((rb) => rb.withReceiver('email').addMatcher('regexfield', MatcherOperator.regex, '(?i)BA.*h'))
        )
    );
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, mockConfig);

    render(
      <NotificationPreviewByAlertManager
        alertManagerSource={grafanaAlertManagerDataSource}
        potentialInstances={potentialInstances}
        onlyOneAM={true}
      />
    );

    expect(await screen.findByText(/regexfield/i)).toBeInTheDocument();
  });
});
