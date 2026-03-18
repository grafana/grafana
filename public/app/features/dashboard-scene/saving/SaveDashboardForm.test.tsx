import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { SceneObjectRef } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardForm, SaveDashboardFormCommonOptions } from './SaveDashboardForm';
import { DashboardChangeInfo } from './shared';
import { useSaveDashboard } from './useSaveDashboard';

jest.mock('./useSaveDashboard');
const useSaveDashboardMock = jest.mocked(useSaveDashboard);

function buildChangeInfo(overrides: Partial<DashboardChangeInfo>): DashboardChangeInfo {
  return {
    changedSaveModel: {},
    initialSaveModel: {},
    diffs: {},
    diffCount: 0,
    hasChanges: false,
    hasTimeChanges: false,
    hasVariableValueChanges: false,
    hasRefreshChange: false,
    ...overrides,
  } as DashboardChangeInfo;
}

function buildDrawer(overrides: Partial<ConstructorParameters<typeof SaveDashboardDrawer>[0]> = {}) {
  const dashboard = new DashboardScene({});
  const drawer = new SaveDashboardDrawer({
    dashboardRef: new SceneObjectRef(dashboard),
    ...overrides,
  });
  drawer.activate();
  return drawer;
}

function renderCommonOptions(
  changeInfo: DashboardChangeInfo,
  drawerOverrides: Partial<ConstructorParameters<typeof SaveDashboardDrawer>[0]> = {}
) {
  const drawer = buildDrawer(drawerOverrides);
  const renderResult = render(<SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />);

  return {
    ...renderResult,
    drawer,
    user: userEvent.setup(),
    elements: {
      timeRangeCheckbox: () => renderResult.queryByTestId(selectors.pages.SaveDashboardModal.saveTimerange),
      refreshCheckbox: () => renderResult.queryByTestId(selectors.pages.SaveDashboardModal.saveRefresh),
      variablesCheckbox: () => renderResult.queryByTestId(selectors.pages.SaveDashboardModal.saveVariables),
      variablesWarningAlert: () => renderResult.queryByTestId(selectors.pages.SaveDashboardModal.variablesWarningAlert),
    },
  };
}

interface RenderSaveFormOptions {
  changeInfo?: Partial<DashboardChangeInfo>;
  drawerOverrides?: Partial<ConstructorParameters<typeof SaveDashboardDrawer>[0]>;
  error?: Error;
  loading?: boolean;
  onSaveDashboard?: jest.Mock;
}

function renderSaveForm({
  changeInfo: changeInfoOverrides = {},
  drawerOverrides = {},
  error,
  loading = false,
  onSaveDashboard = jest.fn(),
}: RenderSaveFormOptions = {}) {
  const dashboard = new DashboardScene({});
  dashboard.activate();

  const drawer = new SaveDashboardDrawer({
    dashboardRef: new SceneObjectRef(dashboard),
    ...drawerOverrides,
  });
  drawer.activate();

  const changeInfo = buildChangeInfo({ hasChanges: true, ...changeInfoOverrides });

  useSaveDashboardMock.mockReturnValue({
    state: { loading, error },
    onSaveDashboard,
  } as unknown as ReturnType<typeof useSaveDashboard>);

  const renderResult = render(<SaveDashboardForm dashboard={dashboard} drawer={drawer} changeInfo={changeInfo} />);

  return {
    ...renderResult,
    dashboard,
    drawer,
    user: userEvent.setup(),
    elements: {
      messageTextarea: () => renderResult.getByLabelText('message') as HTMLTextAreaElement,
      saveButton: () =>
        renderResult.queryByTestId(
          selectors.components.Drawer.DashboardSaveDrawer.saveButton
        ) as HTMLButtonElement | null,
      cancelButton: () => renderResult.queryByRole('button', { name: 'Cancel' }),
      noChangesText: () => renderResult.queryByText('No changes to save'),
      migrationWarning: () => renderResult.queryByText('Dashboard irreversibly changed'),
      messageTooLong: () => renderResult.queryByText('Message too long'),
      versionMismatch: () => renderResult.queryByText('Someone else has updated this dashboard'),
      saveAndOverwrite: () => renderResult.queryByText('Save and overwrite'),
      nameExists: () => renderResult.queryByText('Name already exists'),
      pluginDashboard: () => renderResult.queryByText('Plugin dashboard'),
      failedToSave: () => renderResult.queryByText('Failed to save dashboard'),
    },
  };
}

describe('<SaveDashboardFormCommonOptions />', () => {
  test('when no changes exist, renders no checkboxes', () => {
    const changeInfo = buildChangeInfo({
      hasTimeChanges: false,
      hasRefreshChange: false,
      hasVariableValueChanges: false,
    });

    const { elements } = renderCommonOptions(changeInfo);

    expect(elements.timeRangeCheckbox()).not.toBeInTheDocument();
    expect(elements.refreshCheckbox()).not.toBeInTheDocument();
    expect(elements.variablesCheckbox()).not.toBeInTheDocument();
  });

  test('when hasTimeChanges is true, renders the save time range checkbox', () => {
    const changeInfo = buildChangeInfo({ hasTimeChanges: true });

    const { elements } = renderCommonOptions(changeInfo);

    expect(elements.timeRangeCheckbox()).toBeInTheDocument();
    expect(elements.refreshCheckbox()).not.toBeInTheDocument();
    expect(elements.variablesCheckbox()).not.toBeInTheDocument();
  });

  test('when hasRefreshChange is true, renders the save refresh checkbox', () => {
    const changeInfo = buildChangeInfo({ hasRefreshChange: true });

    const { elements } = renderCommonOptions(changeInfo);

    expect(elements.refreshCheckbox()).toBeInTheDocument();
    expect(elements.timeRangeCheckbox()).not.toBeInTheDocument();
    expect(elements.variablesCheckbox()).not.toBeInTheDocument();
  });

  test('when hasVariableValueChanges is true, renders the save variables checkbox', () => {
    const changeInfo = buildChangeInfo({ hasVariableValueChanges: true });

    const { elements } = renderCommonOptions(changeInfo);

    expect(elements.variablesCheckbox()).toBeInTheDocument();
    expect(elements.timeRangeCheckbox()).not.toBeInTheDocument();
    expect(elements.refreshCheckbox()).not.toBeInTheDocument();
  });

  test('when all changes exist, renders all three checkboxes', () => {
    const changeInfo = buildChangeInfo({
      hasTimeChanges: true,
      hasRefreshChange: true,
      hasVariableValueChanges: true,
    });

    const { elements } = renderCommonOptions(changeInfo);

    expect(elements.timeRangeCheckbox()).toBeInTheDocument();
    expect(elements.refreshCheckbox()).toBeInTheDocument();
    expect(elements.variablesCheckbox()).toBeInTheDocument();
  });

  describe('when save variables is checked', () => {
    test('if showVariablesWarning is true, renders the warning alert', () => {
      const changeInfo = buildChangeInfo({ hasVariableValueChanges: true });

      const { elements } = renderCommonOptions(changeInfo, {
        saveVariables: true,
        showVariablesWarning: true,
      });

      expect(elements.variablesWarningAlert()).toBeInTheDocument();
    });

    test('if showVariablesWarning is false, does not render the warning alert', () => {
      const changeInfo = buildChangeInfo({ hasVariableValueChanges: true });

      const { elements } = renderCommonOptions(changeInfo, {
        saveVariables: true,
        showVariablesWarning: false,
      });

      expect(elements.variablesWarningAlert()).not.toBeInTheDocument();
    });
  });

  describe('when save variables is unchecked', () => {
    test('does not render the warning alert even if showVariablesWarning is true', () => {
      const changeInfo = buildChangeInfo({ hasVariableValueChanges: true });

      const { elements } = renderCommonOptions(changeInfo, {
        saveVariables: false,
        showVariablesWarning: true,
      });

      expect(elements.variablesWarningAlert()).not.toBeInTheDocument();
    });
  });
});

describe('<SaveDashboardForm />', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders the message textarea with an empty default value', () => {
    const { elements } = renderSaveForm();

    expect(elements.messageTextarea()).toBeInTheDocument();
    expect(elements.messageTextarea().value).toBe('');
  });

  test('when user types a message, updates the textarea value', async () => {
    const { elements, user } = renderSaveForm();

    await user.type(elements.messageTextarea(), 'Fixed layout bug');

    expect(elements.messageTextarea().value).toBe('Fixed layout bug');
  });

  describe('when there are no changes', () => {
    test('renders "No changes to save" and disables the save button', () => {
      const { elements } = renderSaveForm({ changeInfo: { hasChanges: false } });

      expect(elements.noChangesText()).toBeInTheDocument();
      expect(elements.saveButton()).toBeDisabled();
    });
  });

  describe('when there are changes', () => {
    test('renders enabled save button without "No changes to save"', () => {
      const { elements } = renderSaveForm({ changeInfo: { hasChanges: true } });

      expect(elements.noChangesText()).not.toBeInTheDocument();
      expect(elements.saveButton()).toBeEnabled();
    });
  });

  describe('migration warning', () => {
    test('when hasMigratedToV2 is true, renders the migration warning alert', () => {
      const { elements } = renderSaveForm({ changeInfo: { hasMigratedToV2: true } });

      expect(elements.migrationWarning()).toBeInTheDocument();
    });

    test('when hasMigratedToV2 is false, does not render the migration warning alert', () => {
      const { elements } = renderSaveForm({ changeInfo: { hasMigratedToV2: false } });

      expect(elements.migrationWarning()).not.toBeInTheDocument();
    });
  });

  test('when user clicks Cancel, calls dashboard.closeModal()', async () => {
    const { elements, user, dashboard } = renderSaveForm();
    jest.spyOn(dashboard, 'closeModal').mockImplementation(() => {});

    await user.click(elements.cancelButton()!);

    expect(dashboard.closeModal).toHaveBeenCalledTimes(1);
  });

  describe('when message exceeds 500 characters', () => {
    test('renders the "Message too long" error instead of save/cancel buttons', async () => {
      const { elements, user } = renderSaveForm();

      await user.type(elements.messageTextarea(), 'a'.repeat(501));

      expect(elements.messageTooLong()).toBeInTheDocument();
      expect(elements.saveButton()).not.toBeInTheDocument();
      expect(elements.cancelButton()).not.toBeInTheDocument();
    });
  });

  describe('when message is exactly 500 characters', () => {
    test('renders the normal footer with save and cancel buttons', async () => {
      const { elements, user } = renderSaveForm();

      await user.type(elements.messageTextarea(), 'a'.repeat(500));

      expect(elements.messageTooLong()).not.toBeInTheDocument();
      expect(elements.saveButton()).toBeInTheDocument();
      expect(elements.cancelButton()).toBeInTheDocument();
    });
  });

  describe('error footer states', () => {
    test('when a version-mismatch error occurs, renders the overwrite prompt', () => {
      const error = Object.assign(new Error('version-mismatch'), {
        status: 412,
        data: { status: 'version-mismatch', message: 'version-mismatch error' },
      });

      const { elements } = renderSaveForm({ error });

      expect(elements.versionMismatch()).toBeInTheDocument();
      expect(elements.saveAndOverwrite()).toBeInTheDocument();
    });

    test('when a name-exists error occurs, renders the NameAlreadyExistsError', () => {
      const error = Object.assign(new Error('name-exists'), {
        status: 412,
        data: { status: 'name-exists', message: 'name-exists error' },
      });

      const { elements } = renderSaveForm({ error });

      expect(elements.nameExists()).toBeInTheDocument();
    });

    test('when a plugin-dashboard error occurs, renders the plugin dashboard warning', () => {
      const error = Object.assign(new Error('plugin-dashboard'), {
        status: 412,
        data: { status: 'plugin-dashboard', message: 'plugin-dashboard error' },
      });

      const { elements } = renderSaveForm({ error });

      expect(elements.pluginDashboard()).toBeInTheDocument();
      expect(elements.saveAndOverwrite()).toBeInTheDocument();
    });

    test('when a generic error occurs, renders the "Failed to save dashboard" alert with the error message', () => {
      const error = new Error('Something went wrong');

      const { elements, getByText } = renderSaveForm({ error });

      expect(elements.failedToSave()).toBeInTheDocument();
      expect(getByText('Something went wrong')).toBeInTheDocument();
    });

    test('when no error and no changes, does not render any error alert', () => {
      const { elements } = renderSaveForm({ changeInfo: { hasChanges: false } });

      expect(elements.failedToSave()).not.toBeInTheDocument();
      expect(elements.versionMismatch()).not.toBeInTheDocument();
      expect(elements.pluginDashboard()).not.toBeInTheDocument();
      expect(elements.nameExists()).not.toBeInTheDocument();
    });
  });
});
