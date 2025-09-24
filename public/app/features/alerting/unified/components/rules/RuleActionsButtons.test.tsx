import { render, screen, userEvent } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { config, locationService, setPluginLinksHook } from '@grafana/runtime';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { contextSrv } from 'app/core/services/context_srv';
import { RuleActionsButtons } from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  getCloudRule,
  getGrafanaRule,
  grantUserPermissions,
  mockDataSource,
  mockGrafanaRulerRule,
  mockPromAlertingRule,
} from 'app/features/alerting/unified/mocks';
import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { setupDataSources } from '../../testSetup/datasources';
import { fromCombinedRule, stringifyIdentifier } from '../../utils/rule-id';

setupMswServer();
jest.mock('app/core/services/context_srv');
const mockContextSrv = jest.mocked(contextSrv);

const ui = {
  detailsButton: byRole('link', { name: /View/ }),
  menu: byRole('menu'),
  moreButton: byLabelText(/More/),
  pauseButton: byRole('menuitem', { name: /Pause evaluation/ }),
};

const grantAllPermissions = () => {
  grantUserPermissions([
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleUpdate,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingInstanceCreate,
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingRuleExternalWrite,
  ]);
  mockContextSrv.hasPermissionInMetadata.mockImplementation(() => true);
  mockContextSrv.hasPermission.mockImplementation(() => true);
};
const grantNoPermissions = () => {
  grantUserPermissions([]);
  mockContextSrv.hasPermissionInMetadata.mockImplementation(() => false);
  mockContextSrv.hasPermission.mockImplementation(() => false);
};

const getMenuContents = async () => {
  await screen.findByRole('menu');
  const allMenuItems = screen.queryAllByRole('menuitem').map((el) => el.textContent);
  const allLinkItems = screen.queryAllByRole('link').map((el) => el.textContent);

  return [...allMenuItems, ...allLinkItems];
};

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));

const mimirDs = mockDataSource({ uid: MIMIR_DATASOURCE_UID, name: 'Mimir' });
const prometheusDs = mockDataSource({ uid: 'prometheus', name: 'Prometheus' });
setupDataSources(mimirDs, prometheusDs);

const clickCopyLink = async () => {
  const user = userEvent.setup();
  await user.click(await ui.moreButton.find());
  await user.click(await screen.findByText(/copy link/i));
};

describe('RuleActionsButtons', () => {
  it('renders correct options for grafana managed rule', async () => {
    const user = userEvent.setup();
    grantAllPermissions();
    const mockRule = getGrafanaRule();

    render(<RuleActionsButtons rule={mockRule} rulesSource="grafana" />);

    await user.click(await ui.moreButton.find());

    expect(await getMenuContents()).toMatchSnapshot();
  });

  it('should be able to pause a Grafana rule', async () => {
    const user = userEvent.setup();
    grantAllPermissions();
    const mockRule = getGrafanaRule();

    render(<RuleActionsButtons rule={mockRule} rulesSource="grafana" />);

    await user.click(await ui.moreButton.find());
    await user.click(await ui.pauseButton.find());

    expect(ui.menu.query()).not.toBeInTheDocument();
  });

  it('renders correct options for Cloud rule', async () => {
    const user = userEvent.setup();
    grantAllPermissions();
    const mockRule = getCloudRule(undefined, { rulesSource: mimirDs });

    render(<RuleActionsButtons rule={mockRule} rulesSource={mimirDs} />);

    await user.click(await ui.moreButton.find());

    expect(await getMenuContents()).toMatchSnapshot();
  });

  it('view rule button should properly handle special characters in rule name', async () => {
    // Production setup uses the link interceptor to push all link clicks through the location service
    // and history object under the hood
    // It causes issues due to the bug in history library that causes the pathname to be decoded
    // https://github.com/remix-run/history/issues/505#issuecomment-453175833
    document.addEventListener('click', interceptLinkClicks);

    grantAllPermissions();
    const mockRule = getCloudRule({ name: 'special !@#$%^&*() chars' }, { rulesSource: mimirDs });
    const { user } = render(<RuleActionsButtons rule={mockRule} rulesSource={mimirDs} showViewButton />, {
      renderWithRouter: true,
    });
    const locationPushSpy = jest.spyOn(locationService, 'push');

    await user.click(await ui.detailsButton.find());

    const ruleId = fromCombinedRule(mimirDs.name, mockRule);
    const stringifiedRuleId = stringifyIdentifier(ruleId);

    const expectedPath = `/alerting/${encodeURIComponent(mimirDs.name)}/${encodeURIComponent(stringifiedRuleId)}/view`;

    // Check if the interceptor worked
    expect(locationPushSpy).toHaveBeenCalledWith(expectedPath);

    // Check if the location service has the correct pathname
    expect(locationService.getLocation().pathname).toBe(expectedPath);
  });

  it('renders minimal "More" menu when appropriate', async () => {
    const user = userEvent.setup();
    grantNoPermissions();

    const mockRule = getGrafanaRule({ promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }) });

    render(<RuleActionsButtons rule={mockRule} rulesSource="grafana" />);

    await user.click(await ui.moreButton.find());

    expect(await getMenuContents()).toMatchSnapshot();
  });

  it('does not allow deletion when rule is provisioned', async () => {
    const user = userEvent.setup();
    grantAllPermissions();
    const mockRule = getGrafanaRule({ rulerRule: mockGrafanaRulerRule({ provenance: 'file' }) });

    render(<RuleActionsButtons rule={mockRule} rulesSource="grafana" />);

    await user.click(await ui.moreButton.find());

    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  describe('copy link', () => {
    beforeEach(() => {
      grantAllPermissions();
      config.appUrl = 'http://localhost:3000/';
      config.appSubUrl = '/sub';
    });

    it('copies correct URL for grafana managed alert rule', async () => {
      const mockRule = getGrafanaRule({ rulerRule: mockGrafanaRulerRule({ uid: 'foo', provenance: 'file' }) });

      render(<RuleActionsButtons rule={mockRule} rulesSource="grafana" />);

      await clickCopyLink();

      expect(await navigator.clipboard.readText()).toBe('http://localhost:3000/sub/alerting/grafana/foo/view');
    });

    it('copies correct URL for cloud rule', async () => {
      const mockRule = getCloudRule({ name: 'pod-1-cpu-firing' }, { rulesSource: prometheusDs });

      render(<RuleActionsButtons rule={mockRule} rulesSource={prometheusDs} />);

      await clickCopyLink();

      expect(await navigator.clipboard.readText()).toBe(
        'http://localhost:3000/sub/alerting/Prometheus/pod-1-cpu-firing/find'
      );
    });
  });
});
