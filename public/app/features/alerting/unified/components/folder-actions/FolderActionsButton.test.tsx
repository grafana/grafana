import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { appEvents } from 'app/core/app_events';
import { type FolderDTO } from 'app/types/folders';

import { alertingFolderActionsApi } from '../../api/alertingFolderActionsApi';
import { useFolderBulkActionAbility } from '../../hooks/abilities/otherAbilities';
import { useGlobalRuleAbility } from '../../hooks/abilities/rules/ruleAbilities';
import { Granted, NotSupported } from '../../hooks/abilities/types';
import { useFolder } from '../../hooks/useFolder';
import { getFolderActionResultMessage } from '../../utils/folderActionMessages';

import { FolderActionsButton } from './FolderActionsButton';

jest.mock('../../hooks/useFolder');
jest.mock('../../hooks/abilities/otherAbilities');
jest.mock('../../hooks/abilities/rules/ruleAbilities');

// The redirect-after-action thunks perform real API calls; the toast wiring under test happens
// before the redirect, so these are stubbed out to no-ops rather than exercised here.
jest.mock('../../state/actions', () => ({
  fetchAllPromAndRulerRulesAction: jest.fn(() => () => Promise.resolve()),
  fetchAllPromRulesAction: jest.fn(() => () => Promise.resolve()),
  fetchRulerRulesAction: jest.fn(() => () => Promise.resolve()),
}));

jest.mock('../../api/alertingFolderActionsApi', () => {
  const actual = jest.requireActual('../../api/alertingFolderActionsApi');
  return {
    ...actual,
    alertingFolderActionsApi: {
      ...actual.alertingFolderActionsApi,
      endpoints: {
        ...actual.alertingFolderActionsApi.endpoints,
        pauseFolder: { ...actual.alertingFolderActionsApi.endpoints.pauseFolder, useMutation: jest.fn() },
        unpauseFolder: { ...actual.alertingFolderActionsApi.endpoints.unpauseFolder, useMutation: jest.fn() },
        deleteGrafanaRulesFromFolder: {
          ...actual.alertingFolderActionsApi.endpoints.deleteGrafanaRulesFromFolder,
          useMutation: jest.fn(),
        },
      },
    },
  };
});

testWithFeatureToggles({ enable: ['alertingBulkActionsInUI'] });

const mockFolder: FolderDTO = {
  canAdmin: true,
  canDelete: true,
  canEdit: true,
  canSave: true,
  created: '',
  createdBy: '',
  hasAcl: false,
  id: 1,
  title: 'My folder',
  uid: 'folder-1',
  updated: '',
  updatedBy: '',
  url: '',
};

function mockMutationHook<T extends () => unknown>(hook: T, trigger: jest.Mock) {
  jest.mocked(hook).mockReturnValue([trigger, { isLoading: false }] as unknown as ReturnType<T>);
}

// Mirrors the shape of the object returned by an RTK Query mutation trigger, i.e. `pauseFolder(args)`.
function resolveTriggerWith(trigger: jest.Mock, result: unknown) {
  trigger.mockReturnValue({ unwrap: () => Promise.resolve(result) });
}

async function openMenu() {
  const { user } = render(<FolderActionsButton folderUID="folder-1" />);
  await user.click(await screen.findByRole('button', { name: /folder actions/i }));
  await waitFor(() => {
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
  return user;
}

describe('FolderActionsButton', () => {
  let pauseTrigger: jest.Mock;
  let unpauseTrigger: jest.Mock;
  let deleteTrigger: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(useFolder).mockReturnValue({ folder: mockFolder, loading: false });
    jest.mocked(useFolderBulkActionAbility).mockReturnValue(Granted);
    jest.mocked(useGlobalRuleAbility).mockReturnValue(NotSupported);

    pauseTrigger = jest.fn();
    unpauseTrigger = jest.fn();
    deleteTrigger = jest.fn();

    mockMutationHook(alertingFolderActionsApi.endpoints.pauseFolder.useMutation, pauseTrigger);
    mockMutationHook(alertingFolderActionsApi.endpoints.unpauseFolder.useMutation, unpauseTrigger);
    mockMutationHook(alertingFolderActionsApi.endpoints.deleteGrafanaRulesFromFolder.useMutation, deleteTrigger);
  });

  it('shows exactly one success toast built from the pause response counts', async () => {
    resolveTriggerWith(pauseTrigger, { message: 'ok', updated: 3, skipped: 2 });
    const emitSpy = jest.spyOn(appEvents, 'emit');

    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /pause all rules/i }));

    await waitFor(() => {
      expect(pauseTrigger).toHaveBeenCalledTimes(1);
    });
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertSuccess, [
      getFolderActionResultMessage('pause', { affected: 3, skipped: 2 }),
    ]);
  });

  it('falls back to the count-less message when the backend response has no counts (rolling deploy compatibility)', async () => {
    resolveTriggerWith(pauseTrigger, { message: 'rules updated successfully' });
    const emitSpy = jest.spyOn(appEvents, 'emit');

    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /pause all rules/i }));

    await waitFor(() => {
      expect(pauseTrigger).toHaveBeenCalledTimes(1);
    });
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertSuccess, [getFolderActionResultMessage('pause')]);
  });

  it('shows exactly one success toast built from the resume response counts', async () => {
    resolveTriggerWith(unpauseTrigger, { message: 'ok', updated: 4, skipped: 1 });
    const emitSpy = jest.spyOn(appEvents, 'emit');

    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /resume all rules/i }));

    await waitFor(() => {
      expect(unpauseTrigger).toHaveBeenCalledTimes(1);
    });
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertSuccess, [
      getFolderActionResultMessage('resume', { affected: 4, skipped: 1 }),
    ]);
  });

  it('shows exactly one success toast built from the delete response counts', async () => {
    resolveTriggerWith(deleteTrigger, { message: 'ok', deleted: 5, skipped: 0 });
    const emitSpy = jest.spyOn(appEvents, 'emit');

    const user = await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: /delete all rules/i }));
    await user.type(await screen.findByTestId(selectors.pages.ConfirmModal.input), 'Delete');
    await user.click(screen.getByTestId(selectors.pages.ConfirmModal.delete));

    await waitFor(() => {
      expect(deleteTrigger).toHaveBeenCalledTimes(1);
    });
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertSuccess, [
      getFolderActionResultMessage('delete', { affected: 5, skipped: 0 }),
    ]);
  });
});
