import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { updateAlertManagerConfigAction } from '../../state/actions';

import AlertmanagerConfig from './AlertmanagerConfig';
import config from './mocks/api/alertmanager/provisioned/config/api/v1/alerts.json';
import {
  EXTERNAL_VANILLA_ALERTMANAGER_UID,
  PROVISIONED_MIMIR_ALERTMANAGER_UID,
  mockDataSources,
  setupVanillaAlertmanagerServer,
} from './mocks/server';

const modifier = /Mac/.test(navigator.platform) ? 'Meta' : 'Control';
const selectAll = `{${modifier}>}a{/${modifier}}`;
const initialConfigJSON = JSON.stringify(
  { template_files: {}, template_file_provenances: {}, alertmanager_config: config.alertmanager_config },
  null,
  2
);

const renderConfiguration = (
  alertManagerSourceName: string,
  { onDismiss = jest.fn(), onSave = jest.fn(), onReset = jest.fn() },
  options?: Parameters<typeof render>[1]
) =>
  render(
    <AlertmanagerProvider accessType="instance">
      <AlertmanagerConfig
        alertmanagerName={alertManagerSourceName}
        onDismiss={onDismiss}
        onSave={onSave}
        onReset={onReset}
      />
    </AlertmanagerProvider>,
    options
  );

const ui = {
  editor: byRole('textbox', { name: 'Alertmanager configuration' }),
  resetButton: byRole('button', { name: /Reset/ }),
  resetConfirmButton: byRole('button', { name: /Yes, reset configuration/ }),
  saveButton: byRole('button', { name: /Save/ }),
  cancelButton: byRole('button', { name: /Cancel/ }),
};

const waitForEditableConfig = async () => {
  await waitFor(() => expect(ui.saveButton.get()).toBeEnabled());
  expect(ui.resetButton.get()).toBeEnabled();
};

describe('Alerting Settings', () => {
  setupMswServer();

  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingInstanceRead]);
  });

  it('should not be able to reset alertmanager config', async () => {
    const onReset = jest.fn();
    renderConfiguration('grafana', { onReset });

    expect(ui.resetButton.query()).not.toBeInTheDocument();
  });

  it('should be able to cancel', async () => {
    const onDismiss = jest.fn();
    renderConfiguration('grafana', { onDismiss });

    await userEvent.click(await ui.cancelButton.get());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('vanilla Alertmanager', () => {
  const server = setupMswServer();

  beforeEach(() => {
    setupVanillaAlertmanagerServer(server);
    setupDataSources(...Object.values(mockDataSources));
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingInstanceRead]);
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 500,
      top: 0,
      right: 800,
      bottom: 500,
      left: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('should be read-only when using vanilla Prometheus Alertmanager', async () => {
    renderConfiguration(EXTERNAL_VANILLA_ALERTMANAGER_UID, {});

    expect(ui.cancelButton.get()).toBeInTheDocument();
    expect(ui.saveButton.query()).not.toBeInTheDocument();
    expect(ui.resetButton.query()).not.toBeInTheDocument();
  });

  it('should not be read-only when Mimir Alertmanager', async () => {
    renderConfiguration(PROVISIONED_MIMIR_ALERTMANAGER_UID, {});

    expect(ui.cancelButton.get()).toBeInTheDocument();
    expect(ui.saveButton.get()).toBeInTheDocument();
    expect(ui.resetButton.get()).toBeInTheDocument();
    await waitForEditableConfig();
  });

  it('should be able to reset non-Grafana alertmanager config', async () => {
    const onReset = jest.fn();
    renderConfiguration(PROVISIONED_MIMIR_ALERTMANAGER_UID, { onReset });

    expect(ui.cancelButton.get()).toBeInTheDocument();
    expect(ui.saveButton.get()).toBeInTheDocument();
    expect(ui.resetButton.get()).toBeInTheDocument();
    await waitForEditableConfig();

    await userEvent.click(ui.resetButton.get());

    await userEvent.click(ui.resetConfirmButton.get());

    await waitFor(() => expect(onReset).toHaveBeenCalled());
    expect(onReset).toHaveBeenLastCalledWith(PROVISIONED_MIMIR_ALERTMANAGER_UID);
  });

  it('submits the edited draft only after blur and clicking Save', async () => {
    const onSave = jest.fn();
    const { user } = renderConfiguration(PROVISIONED_MIMIR_ALERTMANAGER_UID, { onSave });
    const editor = await ui.editor.find();
    const draft = '{"alertmanager_config":{"receivers":[{"name":"updated"}]},"template_files":{}}';

    await user.click(editor);
    await user.keyboard(selectAll);
    await user.paste(draft);
    await user.click(ui.cancelButton.get());

    expect(editor).toHaveTextContent(draft);
    expect(onSave).not.toHaveBeenCalled();

    await user.click(ui.saveButton.get());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(PROVISIONED_MIMIR_ALERTMANAGER_UID, initialConfigJSON, draft)
    );
  });

  it('copies the draft to the form on the save shortcut without submitting or blurring', async () => {
    const onSave = jest.fn();
    const { user } = renderConfiguration(PROVISIONED_MIMIR_ALERTMANAGER_UID, { onSave });
    const editor = await ui.editor.find();
    const draft = '{"alertmanager_config":{},"template_files":{}}';

    await user.click(editor);
    await user.keyboard(selectAll);
    await user.paste(draft);
    await user.keyboard(`{${modifier}>}s{/${modifier}}`);

    expect(editor).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();

    // A user-event click would blur and hide a broken shortcut-to-form update.
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.click(ui.saveButton.get());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(PROVISIONED_MIMIR_ALERTMANAGER_UID, initialConfigJSON, draft)
    );
  });

  it.each([
    { draft: '', error: 'Configuration cannot be empty' },
    { draft: 'invalid JSON', error: /Unexpected token/ },
  ])('validates "$draft" on Save and preserves the draft after an error', async ({ draft, error }) => {
    const onSave = jest.fn();
    const { user } = renderConfiguration(PROVISIONED_MIMIR_ALERTMANAGER_UID, { onSave });
    const editor = await ui.editor.find();

    await user.click(editor);
    await user.keyboard(`${selectAll}{Backspace}`);
    await user.paste(draft);
    await user.click(ui.saveButton.get());

    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(editor).toHaveTextContent(draft || /^$/);
    expect(onSave).not.toHaveBeenCalled();

    await user.click(editor);
    await user.keyboard(selectAll);
    await user.paste('{}');
    await user.click(ui.saveButton.get());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(PROVISIONED_MIMIR_ALERTMANAGER_UID, initialConfigJSON, '{}')
    );
    expect(screen.queryByText('Oops, something went wrong')).not.toBeInTheDocument();
  });

  it('locks the editor while saving and retains the draft when the save fails', async () => {
    const store = configureStore();
    const { user } = renderConfiguration(PROVISIONED_MIMIR_ALERTMANAGER_UID, {}, { store });
    const editor = await ui.editor.find();
    const draft = '{"alertmanager_config":{},"template_files":{}}';
    const update = {
      alertManagerSourceName: PROVISIONED_MIMIR_ALERTMANAGER_UID,
      oldConfig: config,
      newConfig: config,
    };

    await user.click(editor);
    await user.keyboard(selectAll);
    await user.paste(draft);

    act(() => {
      store.dispatch(updateAlertManagerConfigAction.pending('save-config', update));
    });

    expect(ui.saveButton.get()).toBeDisabled();
    expect(ui.resetButton.get()).toBeDisabled();
    expect(ui.cancelButton.get()).toBeDisabled();
    expect(editor).toHaveAttribute('aria-readonly', 'true');
    await user.keyboard(`${selectAll}{Backspace}`);
    expect(editor).toHaveTextContent(draft);

    act(() => {
      store.dispatch(updateAlertManagerConfigAction.rejected(new Error('Save failed'), 'save-config', update));
    });

    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    expect(editor).not.toHaveAttribute('aria-readonly', 'true');
    expect(editor).toHaveTextContent(draft);
    expect(ui.saveButton.get()).toBeEnabled();
  });
});
