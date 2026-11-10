import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byLabelText, byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';

import { type DataSourceApi, dateTime } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { mockAlertRuleApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setFolderAccessControl } from 'app/features/alerting/unified/mocks/server/configure';
import { MOCK_GRAFANA_ALERT_RULE_TITLE } from 'app/features/alerting/unified/mocks/server/constants';
import { waitForServerRequest } from 'app/features/alerting/unified/mocks/server/events';
import {
  MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER,
  MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER,
} from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import {
  getAlertRuleHandler,
  mockK8sAlertRule,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/alertRules.k8s';
import { silenceCreateHandler } from 'app/features/alerting/unified/mocks/server/handlers/silences';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import { MatcherOperator, SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { contextSrv } from '../../../core/services/context_srv';

import NewSilencePage from './NewSilencePage';
import ExistingSilenceEditorPage from './components/silences/SilencesEditor';
import SilencesTablePage from './components/silences/SilencesTable';
import {
  MOCK_SILENCE_ID_EXISTING,
  MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID,
  MOCK_SILENCE_ID_LACKING_PERMISSIONS,
  grantUserPermissions,
  mockDataSource,
  mockSilences,
} from './mocks';
import { grafanaRulerRule } from './mocks/grafanaRulerApi';
import { setupDataSources } from './testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

const TEST_TIMEOUT = 60000;

const renderSilences = (location = '/alerting/silences/') => {
  return render(
    <Routes>
      <Route path="/alerting/silences" element={<SilencesTablePage />} />
      <Route path="/alerting/silence/new" element={<NewSilencePage />} />
      <Route path="/alerting/silence/:id/edit" element={<ExistingSilenceEditorPage />} />
    </Routes>,
    {
      historyOptions: {
        initialEntries: [location],
      },
    }
  );
};

const dataSources = {
  am: mockDataSource({
    name: GRAFANA_RULES_SOURCE_NAME,
    type: DataSourceType.Alertmanager,
  }),
  [MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER]: mockDataSource({
    uid: MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER,
    name: MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER,
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  notExpiredTable: byTestId('not-expired-table'),
  expiredTable: byTestId('expired-table'),
  expiredCaret: byText(/expired silences \(/i),
  silenceRow: byTestId('row'),
  silencedAlertCell: byTestId('alerts'),
  addSilenceButton: byRole('link', { name: /add silence/i }),
  existingSilenceNotFound: byRole('alert', { name: /existing silence .* not found/i }),
  noPermissionToEdit: byRole('alert', { name: /do not have permission/i }),
  ruleUnavailable: byRole('alert', { name: /alert rule unavailable/i }),
  editor: {
    timeRange: byTestId(selectors.components.TimePicker.openButton),
    durationField: byLabelText('Duration'),
    durationInput: byRole('textbox', { name: /duration/i }),
    matchersField: byTestId('matcher'),
    matcherName: byPlaceholderText('label'),
    matcherValue: byPlaceholderText('value'),
    comment: byLabelText(/Comment/i),
    matcherOperatorSelect: byLabelText('operator'),
    matcherOperator: (operator: MatcherOperator) => byText(operator, { exact: true }),
    addMatcherButton: byRole('button', { name: 'Add matcher' }),
    submit: byRole('button', { name: /save silence/i }),
    createdBy: byText(/created by \*/i),
    loadingIndicator: byTestId('Spinner'),
  },
};

const setUserLogged = (isLogged: boolean) => {
  contextSrv.user.isSignedIn = isLogged;
  contextSrv.user.name = isLogged ? 'admin' : '';
};

const enterSilenceLabel = async (
  user: ReturnType<typeof renderSilences>['user'],
  index: number,
  name: string,
  matcher: MatcherOperator,
  value: string
) => {
  const row = ui.editor.matchersField.getAll()[index];
  await user.type(ui.editor.matcherName.get(row), name);
  await user.click(ui.editor.matcherOperatorSelect.get(row));
  await user.click(ui.editor.matcherOperator(matcher).get(screen.getByRole('listbox')));
  await user.type(ui.editor.matcherValue.get(row), value);
};

const addAdditionalMatcher = async (user: ReturnType<typeof renderSilences>['user']) => {
  await user.click(ui.editor.addMatcherButton.get());
};

const server = setupMswServer();

beforeEach(() => {
  const dsSrv = setupDataSources(dataSources.am, dataSources[MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER]);
  const origGet = dsSrv.get.bind(dsSrv);
  jest.spyOn(dsSrv, 'get').mockImplementation((ref, scopedVars) => {
    if (ref === null || ref === undefined) {
      return Promise.resolve({} as DataSourceApi);
    }
    return origGet(ref, scopedVars);
  });
  grantUserPermissions([
    AccessControlAction.AlertingInstanceRead,
    AccessControlAction.AlertingInstanceCreate,
    AccessControlAction.AlertingInstanceUpdate,
    AccessControlAction.AlertingInstancesExternalRead,
    AccessControlAction.AlertingInstancesExternalWrite,
  ]);
});

describe('Silences', () => {
  it(
    'shows silence details, alert counts, creation access, unavailable-rule warnings, and toggles expired silences',
    async () => {
      const { user } = renderSilences();

      const notExpiredTable = await ui.notExpiredTable.find();
      expect(notExpiredTable).toBeInTheDocument();

      const silencedAlertRows = await ui.silencedAlertCell.findAll(notExpiredTable);
      expect(silencedAlertRows[0]).toHaveTextContent('2');
      expect(silencedAlertRows[1]).toHaveTextContent('0');
      expect(await ui.addSilenceButton.find()).toBeInTheDocument();
      expect(within(notExpiredTable).getByText(/alert rule unavailable/i)).toBeInTheDocument();
      expect(within(notExpiredTable).getByLabelText('Alert rule unavailable')).toBeVisible();

      await user.click(ui.expiredCaret.get());
      expect(ui.expiredTable.get()).toBeInTheDocument();

      const allSilences = ui.silenceRow.queryAll();
      expect(allSilences).toHaveLength(mockSilences.length);
      expect(within(allSilences[0]).getByLabelText('Tags')).toHaveTextContent('foo=bar');
      expect(within(allSilences[1]).getByLabelText('Tags')).toHaveTextContent('foo!=bar');
      expect(allSilences[2]).toHaveTextContent(MOCK_GRAFANA_ALERT_RULE_TITLE);
      const alertRuleLink = within(allSilences[2]).getByRole('link', { name: MOCK_GRAFANA_ALERT_RULE_TITLE });
      expect(alertRuleLink).toHaveAttribute('href', expect.stringContaining(MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID));

      await user.click(ui.expiredCaret.get());

      expect(ui.notExpiredTable.get()).toBeInTheDocument();
      expect(ui.expiredTable.query()).not.toBeInTheDocument();

      const activeSilences = ui.silenceRow.queryAll();
      const expectedActiveSilences = mockSilences.filter(
        (silence) => silence.status.state !== SilenceState.Expired
      ).length;
      expect(activeSilences).toHaveLength(expectedActiveSilences);
      expect(activeSilences[0]).toHaveTextContent('foo=bar');
      expect(activeSilences[1]).toHaveTextContent('foo!=bar');
    },
    TEST_TIMEOUT
  );

  it(
    'fetches silenced alerts with correct filter parameters',
    async () => {
      let capturedParams: URLSearchParams | undefined;
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json([]);
        })
      );

      renderSilences();

      await waitFor(() => expect(capturedParams).toBeDefined());

      expect(capturedParams?.get('silenced')).toBe('true');
      expect(capturedParams?.get('active')).toBe('false');
      expect(capturedParams?.get('inhibited')).toBe('false');
    },
    TEST_TIMEOUT
  );

  it(
    'filters silences by matchers and shows filter pills from the URL',
    async () => {
      // foo="bar" matches only silences with an exact foo=bar matcher (name, value, operator all match)
      renderSilences('/alerting/silences?queryString=foo%3D%22bar%22');

      expect(await ui.notExpiredTable.find()).toBeInTheDocument();
      expect(ui.silenceRow.getAll()).toHaveLength(1);
      expect(screen.getByLabelText(/Edit filter with key foo/i)).toBeInTheDocument();
    },
    TEST_TIMEOUT
  );

  it(
    'does not request alert instances for users with only silence read access',
    async () => {
      grantUserPermissions([AccessControlAction.AlertingSilenceRead]);

      let alertsRequested = false;
      server.use(
        http.get('/api/alertmanager/grafana/api/v2/alerts', () => {
          alertsRequested = true;
          return HttpResponse.json({ message: 'Permissions needed: alert.instances:read' }, { status: 403 });
        })
      );

      renderSilences();

      expect(await ui.notExpiredTable.find()).toBeInTheDocument();
      expect(alertsRequested).toBe(false);
    },
    TEST_TIMEOUT
  );

  it('hides actions for creating a silence for users without access', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingInstancesExternalRead]);

    renderSilences();

    const notExpiredTable = await ui.notExpiredTable.find();

    expect(notExpiredTable).toBeInTheDocument();

    expect(ui.addSilenceButton.query()).not.toBeInTheDocument();
  });

  it('handles error case when broken alertmanager is used', async () => {
    renderSilences(`/alerting/silences?alertmanager=${encodeURIComponent(MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER)}`);
    expect(await screen.findByText(/error loading silences/i)).toBeInTheDocument();
  });
});

describe('Silence create/edit', () => {
  const baseUrlPath = '/alerting/silence/new';

  beforeEach(() => {
    mockAlertRuleApi(server).getAlertRule(MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID, grafanaRulerRule);
    setUserLogged(true);
  });

  it('shows matching labels without created by for a named, signed-in user on an unscoped form', async () => {
    renderSilences(baseUrlPath);
    expect(await screen.findByText(/^matching labels/i)).toBeInTheDocument();
    expect(screen.queryByText(/refine affected alerts/i)).not.toBeInTheDocument();
    expect(ui.editor.createdBy.query()).not.toBeInTheDocument();
  });
  it('Should render createdBy if user is not logged or has no name', async () => {
    setUserLogged(false);
    renderSilences(baseUrlPath);
    await waitFor(() => expect(ui.editor.createdBy.get()).toBeInTheDocument());
  });
  it(
    'prefills the matchers field with matchers params',
    async () => {
      const matchersParams = ['foo=bar', 'bar=~ba.+', 'hello!=world', 'cluster!~us-central.*'];
      const matchersQueryString = matchersParams.map((matcher) => `matcher=${encodeURIComponent(matcher)}`).join('&');

      renderSilences(`${baseUrlPath}?${matchersQueryString}`);
      expect(await ui.editor.durationField.find()).toBeInTheDocument();

      const matchers = ui.editor.matchersField.queryAll();
      expect(matchers).toHaveLength(4);

      expect(ui.editor.matcherName.query(matchers[0])).toHaveValue('foo');
      expect(ui.editor.matcherOperator(MatcherOperator.equal).query(matchers[0])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[0])).toHaveValue('bar');

      expect(ui.editor.matcherName.query(matchers[1])).toHaveValue('bar');
      expect(ui.editor.matcherOperator(MatcherOperator.regex).query(matchers[1])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[1])).toHaveValue('ba.+');

      expect(ui.editor.matcherName.query(matchers[2])).toHaveValue('hello');
      expect(ui.editor.matcherOperator(MatcherOperator.notEqual).query(matchers[2])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[2])).toHaveValue('world');

      expect(ui.editor.matcherName.query(matchers[3])).toHaveValue('cluster');
      expect(ui.editor.matcherOperator(MatcherOperator.notRegex).query(matchers[3])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[3])).toHaveValue('us-central.*');
    },
    TEST_TIMEOUT
  );

  it(
    'creates a new silence',
    async () => {
      const { user } = renderSilences(`${baseUrlPath}?alertmanager=${GRAFANA_RULES_SOURCE_NAME}`);
      expect(await ui.editor.durationField.find()).toBeInTheDocument();

      const postRequest = waitForServerRequest(silenceCreateHandler());

      const start = new Date();
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

      const startDateString = dateTime(start).format('YYYY-MM-DD');
      const endDateString = dateTime(end).format('YYYY-MM-DD');

      await user.clear(ui.editor.durationInput.get());
      await user.type(ui.editor.durationInput.get(), '1d');

      await waitFor(() => expect(ui.editor.durationInput.query()).toHaveValue('1d'));
      await waitFor(() => expect(ui.editor.timeRange.get()).toHaveTextContent(startDateString));
      await waitFor(() => expect(ui.editor.timeRange.get()).toHaveTextContent(endDateString));

      await enterSilenceLabel(user, 0, 'foo', MatcherOperator.equal, 'bar');

      await addAdditionalMatcher(user);
      await enterSilenceLabel(user, 1, 'bar', MatcherOperator.notEqual, 'buzz');

      await addAdditionalMatcher(user);
      await enterSilenceLabel(user, 2, 'region', MatcherOperator.regex, 'us-west-.*');

      await addAdditionalMatcher(user);
      await enterSilenceLabel(user, 3, 'env', MatcherOperator.notRegex, 'dev|staging');

      await user.click(ui.editor.submit.get());

      expect(await ui.notExpiredTable.find()).toBeInTheDocument();

      const createSilenceRequest = await postRequest;
      const requestBody = await createSilenceRequest.clone().json();
      expect(requestBody).toMatchObject(
        expect.objectContaining({
          comment: expect.stringMatching(/created (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/),
          matchers: [
            { isEqual: true, isRegex: false, name: 'foo', value: 'bar' },
            { isEqual: false, isRegex: false, name: 'bar', value: 'buzz' },
            { isEqual: true, isRegex: true, name: 'region', value: 'us-west-.*' },
            { isEqual: false, isRegex: true, name: 'env', value: 'dev|staging' },
          ],
        })
      );
    },
    TEST_TIMEOUT
  );

  it('works when previewing alerts with spaces in label name', async () => {
    const { user } = renderSilences(`${baseUrlPath}?alertmanager=${GRAFANA_RULES_SOURCE_NAME}`);

    await enterSilenceLabel(user, 0, 'label with spaces', MatcherOperator.equal, 'value with spaces');

    expect((await screen.findAllByTestId('row'))[0]).toBeInTheDocument();
  });

  it('shows an error when existing silence cannot be found', async () => {
    renderSilences('/alerting/silence/foo-bar/edit');

    expect(await ui.existingSilenceNotFound.find()).toBeInTheDocument();
  });

  it('shows an error when user cannot edit/recreate silence', async () => {
    renderSilences(`/alerting/silence/${MOCK_SILENCE_ID_LACKING_PERMISSIONS}/edit`);
    expect(await ui.noPermissionToEdit.find()).toBeInTheDocument();
  });

  it(
    'populates the existing silence and includes its id when saving',
    async () => {
      const { user } = renderSilences(`/alerting/silence/${MOCK_SILENCE_ID_EXISTING}/edit`);

      // Await the first value to be populated, after which we can expect that all of the other
      // existing fields have been filled out as well
      await waitFor(() => expect(ui.editor.matcherName.get()).toHaveValue('foo'));
      expect(ui.editor.matcherValue.get()).toHaveValue('bar');
      expect(ui.editor.comment.get()).toHaveValue('Happy path silence');

      const postRequest = waitForServerRequest(silenceCreateHandler());
      await user.click(ui.editor.submit.get());

      const createSilenceRequest = await postRequest;
      const requestBody = await createSilenceRequest.clone().json();
      expect(requestBody).toMatchObject({
        id: MOCK_SILENCE_ID_EXISTING,
        matchers: [{ isEqual: true, isRegex: false, name: 'foo', value: 'bar' }],
      });
    },
    TEST_TIMEOUT
  );

  it('populates form with existing silence information that has __alert_rule_uid__', async () => {
    server.use(
      getAlertRuleHandler([
        mockK8sAlertRule({ uid: MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID, title: grafanaRulerRule.grafana_alert.title }),
      ])
    );
    renderSilences(`/alerting/silence/${MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID}/edit`);
    expect(await screen.findByLabelText(/alert rule/i)).toHaveValue(grafanaRulerRule.grafana_alert.title);
  });

  it('populates form with information when specifying alert rule UID in matchers', async () => {
    renderSilences(`/alerting/silence/new?matcher=${MATCHER_ALERT_RULE_UID}%3D${grafanaRulerRule.grafana_alert.uid}`);
    expect(await screen.findByLabelText(/alert rule/i)).toHaveValue(grafanaRulerRule.grafana_alert.title);
  });

  it(
    'silences page should contain alertmanager parameter after creating a silence',
    async () => {
      const postRequest = waitForServerRequest(silenceCreateHandler());

      const { user } = renderSilences(`${baseUrlPath}?alertmanager=${GRAFANA_RULES_SOURCE_NAME}`);
      await waitFor(() => expect(ui.editor.durationField.query()).not.toBeNull());

      await enterSilenceLabel(user, 0, 'foo', MatcherOperator.equal, 'bar');

      await user.click(ui.editor.submit.get());

      expect(await ui.notExpiredTable.find()).toBeInTheDocument();

      expect(locationService.getSearch().get('alertmanager')).toBe(GRAFANA_RULES_SOURCE_NAME);

      const createSilenceRequest = await postRequest;
      const requestBody = await createSilenceRequest.clone().json();
      expect(requestBody).toMatchObject(
        expect.objectContaining({
          matchers: [{ isEqual: true, isRegex: false, name: 'foo', value: 'bar' }],
        })
      );
    },
    TEST_TIMEOUT
  );

  const ruleSilenceUrlPath = `${baseUrlPath}?matcher=${MATCHER_ALERT_RULE_UID}%3D${grafanaRulerRule.grafana_alert.uid}`;

  // A silence with no rule attached can silence alerts from any rule, so the backend asks for the
  // org-wide create permission - folder permissions are no help. Someone whose silence permission
  // comes from a folder can still follow a link to this page, and should be told rather than shown
  // a form that fails on save.
  it('shows a permission error for a silence that is not tied to an alert rule', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingSilenceCreate]);
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    renderSilences(baseUrlPath);

    expect(await ui.noPermissionToEdit.find()).toBeInTheDocument();
    expect(ui.editor.durationField.query()).not.toBeInTheDocument();
  });

  // A silence for a single rule only affects that rule, so silence create on the folder the rule
  // lives in is enough - no org-wide permission needed.
  it('renders the form for a rule silence when the rule folder allows creating silences', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead]);
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    renderSilences(ruleSilenceUrlPath);

    expect(await screen.findByLabelText(/alert rule/i)).toHaveValue(grafanaRulerRule.grafana_alert.title);
    expect(ui.noPermissionToEdit.query()).not.toBeInTheDocument();
  });

  it('shows a permission error for a rule silence when the rule folder does not allow creating silences', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead]);
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceRead]: true });

    renderSilences(ruleSilenceUrlPath);

    expect(await ui.noPermissionToEdit.find()).toBeInTheDocument();
    expect(ui.editor.durationField.query()).not.toBeInTheDocument();
  });

  // Reading the rule needs alert.rules:read on its folder, which the backend does not ask for when
  // creating a silence. A failed lookup therefore says nothing about whether the silence is
  // allowed, so blaming permissions would be misleading.
  it('reports the rule as unavailable rather than blaming permissions when the rule cannot be loaded', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead]);
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    renderSilences(`${baseUrlPath}?matcher=${MATCHER_ALERT_RULE_UID}%3Ddoes-not-exist`);

    expect(await ui.ruleUnavailable.find()).toBeInTheDocument();
    expect(ui.noPermissionToEdit.query()).not.toBeInTheDocument();
    expect(ui.editor.durationField.query()).not.toBeInTheDocument();
  });

  // Sending someone to the rule detail pages only helps if they can silence a rule once they get
  // there. Reaching this page on silence update permission alone does not give them that.
  it('omits the rule-page suggestion for a user who cannot silence any rule', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingSilenceUpdate]);

    renderSilences(baseUrlPath);

    expect(await ui.noPermissionToEdit.find()).toBeInTheDocument();
    expect(screen.queryByText(/silence individual alert rules/i)).not.toBeInTheDocument();
  });

  it('suggests the rule detail pages to a user who can silence rules in a folder', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingSilenceCreate]);

    renderSilences(baseUrlPath);

    expect(await ui.noPermissionToEdit.find()).toBeInTheDocument();
    expect(screen.getByText(/silence individual alert rules/i)).toBeInTheDocument();
  });

  // The backend lets anyone holding the org-wide permission through before it resolves the rule's
  // folder, so a rule we cannot load must not stop them.
  it('renders the form for an unloadable rule when the org-wide permission is held', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingInstanceCreate]);

    renderSilences(`${baseUrlPath}?matcher=${MATCHER_ALERT_RULE_UID}%3Ddoes-not-exist`);

    expect(await ui.editor.durationField.find()).toBeInTheDocument();
    expect(ui.ruleUnavailable.query()).not.toBeInTheDocument();
    expect(ui.noPermissionToEdit.query()).not.toBeInTheDocument();
  });
});
