import { act, cleanup, screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';
import { byTestId, byText } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { ConstantVariable, sceneGraph, SceneRefreshPicker } from '@grafana/scenes';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeyUseCrossDashboardVariables, ManagerKind } from 'app/features/apiserver/types';
import {
  type DashboardRepositoryView,
  useDashboardRepositoryView,
} from 'app/features/provisioning/hooks/useDashboardRepositoryView';
import { RepoViewStatus } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { type SaveDashboardResponseDTO } from 'app/types/dashboard';

import { type DashboardSceneState } from '../scene/types/dashboard';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { type SaveDashboardDrawer } from './SaveDashboardDrawer';
import {
  registerSaveAsTemplateForm,
  type SaveAsTemplateFormProps,
} from './enterprise-components/SaveAsTemplateFormExtension';
import {
  registerSaveDashboardTemplateForm,
  type SaveDashboardTemplateFormProps,
} from './enterprise-components/SaveDashboardTemplateFormExtension';

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: {
    validateNewDashboardName: () => true,
  },
}));

// Monaco can't boot web workers in jsdom
jest.mock('app/core/components/MonacoDiffEditor/MonacoDiffEditor', () => ({
  MonacoDiffEditor: () => <div data-testid="schema-diff-editor" />,
}));

const saveDashboardMutationMock = jest.fn();

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [saveDashboardMutationMock],
}));

jest.mock('app/features/provisioning/hooks/useDashboardRepositoryView', () => {
  const actual = jest.requireActual('app/features/provisioning/hooks/useDashboardRepositoryView');
  return { ...actual, useDashboardRepositoryView: jest.fn(actual.useDashboardRepositoryView) };
});

jest.mock('app/features/provisioning/components/Dashboards/SaveProvisionedDashboard', () => ({
  SaveProvisionedDashboard: ({ view }: { view: DashboardRepositoryView }) => (
    <div data-testid="provisioned-form" data-held={String(view.isHeld)} />
  ),
}));

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  ...jest.requireActual('app/features/dashboard/api/dashboard_api'),
  getDashboardAPI: jest.fn().mockResolvedValue({
    getDashboardDTO: jest.fn().mockResolvedValue({
      apiVersion: 'dashboard.grafana.app/v2beta1',
      kind: 'Dashboard',
      metadata: {},
      spec: {},
    }),
  }),
}));

const ui = {
  saveDashbordText: byText('Save dashboard'),
  saveVariablesCheckbox: byTestId(selectors.pages.SaveDashboardModal.saveVariables),
  variablesWarningAlert: byTestId(selectors.pages.SaveDashboardModal.variablesWarningAlert),
};

describe('SaveDashboardDrawer', () => {
  describe('Given an already saved dashboard', () => {
    it('should render save drawer with only message textarea', async () => {
      await setup().openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveTimerange)).not.toBeInTheDocument();
      expect(screen.getByText('No changes to save')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();
    });

    it('When there are no changes', async () => {
      await setup().openAndRender();
      expect(screen.getByText('No changes to save')).toBeInTheDocument();
    });

    it('When time range changed show save time range option', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveTimerange)).toBeInTheDocument();
    });

    it('When variable changed show save variables option', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph
        .getVariables(dashboard)
        .setState({ variables: [new ConstantVariable({ name: 'constant', type: 'constant', value: 'new value' })] });

      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(ui.saveVariablesCheckbox.get()).toBeInTheDocument();
      expect(ui.variablesWarningAlert.query()).not.toBeInTheDocument(); // the alert shouldn't show as default

      // checking the checkbox shouldn't show the alert because there are no variables with errors
      await userEvent.click(ui.saveVariablesCheckbox.get());
      expect(ui.variablesWarningAlert.query()).not.toBeInTheDocument();
    });

    it('When variable has error show save variables warning', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph.getVariables(dashboard).setState({
        variables: [
          new ConstantVariable({
            name: 'constant',
            type: 'constant',
            value: 'new value',
            error: new Error('Some error'),
          }),
        ],
      });

      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(ui.saveVariablesCheckbox.get()).toBeInTheDocument();
      expect(ui.variablesWarningAlert.query()).not.toBeInTheDocument(); // the alert shouldn't show as default

      // checking the save variables checkbox should show the alert
      await userEvent.click(ui.saveVariablesCheckbox.get());
      await waitFor(() => expect(ui.variablesWarningAlert.query()).toBeInTheDocument());

      // unchecking the save variables checkbox should hide the alert
      await userEvent.click(ui.saveVariablesCheckbox.get());
      expect(ui.variablesWarningAlert.query()).not.toBeInTheDocument();
    });

    it('Should update diff when including time range is', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveTimerange)).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId(selectors.pages.SaveDashboardModal.saveTimerange));

      expect(await screen.findByRole('tab', { name: /Changes/ })).toBeInTheDocument();
    });

    it('Should keep form state when switching between Details and Changes tabs', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      await openAndRender();

      await userEvent.click(screen.getByTestId(selectors.pages.SaveDashboardModal.saveTimerange));
      const message = await screen.findByLabelText('message');
      await userEvent.type(message, 'my save note');

      await userEvent.click(await screen.findByRole('tab', { name: /Changes/ }));
      expect(screen.getByLabelText('message')).not.toBeVisible();

      await userEvent.click(screen.getByRole('tab', { name: /Details/ }));
      expect(screen.getByLabelText('message')).toBeVisible();
      expect(screen.getByLabelText('message')).toHaveValue('my save note');
    });

    it('When refresh changed show save refresh option', async () => {
      const { dashboard, openAndRender } = setup();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '5s' });
      }

      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveRefresh)).toBeInTheDocument();
    });

    it('Should update diff when including time range is', async () => {
      const { dashboard, openAndRender } = setup();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '5s' });
      }

      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.getByTestId(selectors.pages.SaveDashboardModal.saveRefresh)).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId(selectors.pages.SaveDashboardModal.saveRefresh));

      expect(await screen.findByRole('tab', { name: /Changes/ })).toBeInTheDocument();
    });

    it('Can show changes', async () => {
      const { dashboard, openAndRender } = setup();

      dashboard.setState({ title: 'New title' });

      await openAndRender();

      await userEvent.click(await screen.findByRole('tab', { name: /Changes/ }));

      expect(await screen.findByTestId('schema-diff-editor')).toBeInTheDocument();
    });

    it('Can save', async () => {
      const { dashboard, openAndRender } = setup();

      dashboard.setState({ title: 'New title' });

      await openAndRender();

      mockSaveDashboard();

      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.dashboard.title).toEqual('New title');
      expect(dashboard.state.version).toEqual(11);
      expect(dashboard.state.uid).toEqual('my-uid-from-resp');
      expect(dashboard.state.isDirty).toEqual(false);
    });

    it('Can handle save errors and overwrite', async () => {
      const { dashboard, openAndRender } = setup();

      dashboard.setState({ title: 'New title' });

      await openAndRender();

      mockSaveDashboard({ saveError: 'version-mismatch' });

      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      expect(await screen.findByText('Someone else has updated this dashboard')).toBeInTheDocument();
      expect(await screen.findByText('Save and overwrite')).toBeInTheDocument();

      // Now save and overwrite
      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[1][0];
      expect(dataSent.overwrite).toEqual(true);
    });
  });

  describe('When a dashboard is managed by an external system', () => {
    beforeEach(() => {
      config.provisioningEnabled = true;
    });

    afterEach(() => {
      config.provisioningEnabled = false;
    });

    it('It should show the changes tab if the resource can be edited', async () => {
      const { dashboard, openAndRender } = setup({
        meta: {
          k8s: {
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
            },
          },
        },
      });

      // just changing the title here, in real case scenario changes are reflected through migrations
      // eg. panel version - same for other manager tests below
      dashboard.setState({ title: 'updated title' });
      await openAndRender();

      expect(screen.queryByRole('tab', { name: /Changes/ })).toBeInTheDocument();
    });

    it('It should not show the changes tab if the resource cannot be edited; kubectl', async () => {
      const { dashboard, openAndRender } = setup({
        meta: { k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Kubectl } } },
      });

      dashboard.setState({ title: 'updated title' });
      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();
    });

    it('It should not show the changes tab if the resource cannot be edited; terraform', async () => {
      const { dashboard, openAndRender } = setup({
        meta: { k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Terraform } } },
      });

      dashboard.setState({ title: 'updated title' });
      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();
    });

    it('It should not show the changes tab if the resource cannot be edited; plugin', async () => {
      const { dashboard, openAndRender } = setup({
        meta: {
          k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Plugin } },
        },
      });

      dashboard.setState({ title: 'updated title' });
      await openAndRender();

      expect(await ui.saveDashbordText.find()).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();
    });
  });

  describe('Save as copy', () => {
    it('Should show save as form', async () => {
      const { openAndRender } = setup();
      await openAndRender({ saveAsCopy: true });

      expect(await screen.findByText('Save dashboard copy')).toBeInTheDocument();

      mockSaveDashboard();

      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.dashboard.uid).toEqual('');
      expect(dataSent.k8s).toBeUndefined();
    });

    it('restores meta on cancel after a Save As folder change', async () => {
      const { dashboard, openAndRender } = setup({
        meta: { folderUid: 'original-folder', folderTitle: 'Original' },
      });
      const initialFolderUid = dashboard.getInitialState()?.meta.folderUid;

      const drawer = await openAndRender({ saveAsCopy: true });
      expect(await screen.findByText('Save dashboard copy')).toBeInTheDocument();

      act(() => {
        dashboard.setState({
          meta: {
            ...dashboard.state.meta,
            folderUid: 'other-folder',
            folderTitle: 'Other',
          },
        });
      });
      expect(dashboard.state.meta.folderUid).toBe('other-folder');

      act(() => {
        drawer.onClose();
      });

      expect(dashboard.state.overlay).toBeUndefined();
      expect(dashboard.state.meta.folderUid).toBe(initialFolderUid);
    });

    it('Should persist cross-dashboard variable selection annotations', async () => {
      const selection = '{"global":"all","folder":"all"}';
      const { dashboard, openAndRender } = setup();
      dashboard.setState({
        meta: {
          ...dashboard.state.meta,
          k8s: {
            ...dashboard.state.meta.k8s,
            annotations: {
              ...dashboard.state.meta.k8s?.annotations,
              [AnnoKeyUseCrossDashboardVariables]: selection,
            },
          },
        },
      });

      await openAndRender({ saveAsCopy: true });
      expect(await screen.findByText('Save dashboard copy')).toBeInTheDocument();

      mockSaveDashboard();
      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.k8s).toEqual({
        annotations: { [AnnoKeyUseCrossDashboardVariables]: selection },
      });
      expect(dataSent.k8s?.name).toBeUndefined();
    });
  });

  describe('Routing a new save by its repository lookup', () => {
    const folderlessRepo: RepositoryView = {
      name: 'root-repo',
      title: 'Root repo',
      type: 'github',
      target: 'folderless',
      workflows: ['write'],
    };

    function view(overrides: Partial<DashboardRepositoryView> = {}): DashboardRepositoryView {
      const status = overrides.status ?? RepoViewStatus.Ready;
      return {
        status,
        isNewSave: true,
        isProvisioned: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        isMissingRepo: false,
        isHeld: false,
        lookup: { status, error: overrides.error },
        ...overrides,
      };
    }

    afterEach(() => {
      const { useDashboardRepositoryView: actual } = jest.requireActual(
        'app/features/provisioning/hooks/useDashboardRepositoryView'
      );
      jest.mocked(useDashboardRepositoryView).mockImplementation(actual);
    });

    it("shows a spinner until a new dashboard's first lookup settles, then the save-as form", async () => {
      let repoState = view({ status: RepoViewStatus.Loading });
      jest.mocked(useDashboardRepositoryView).mockImplementation(() => repoState);

      const { dashboard, openAndRender } = setup();
      await openAndRender({ saveAsCopy: true });

      // Mounting a form here would swap it out once the repository resolves, dropping typed input
      expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
      expect(
        screen.queryByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)
      ).not.toBeInTheDocument();

      repoState = view();
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta } });
      });

      expect(
        await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)
      ).toBeInTheDocument();
      expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
    });

    it('swaps to the provisioned form once the pick settles on a repository', async () => {
      let repoState = view();
      jest.mocked(useDashboardRepositoryView).mockImplementation(() => repoState);

      const { dashboard, openAndRender } = setup();
      await openAndRender({ saveAsCopy: true });
      expect(
        await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)
      ).toBeInTheDocument();

      repoState = view({ isProvisioned: true, repository: { ...folderlessRepo, target: 'folder' } });
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: 'provisioned-folder' } });
      });

      expect(screen.getByTestId('provisioned-form')).toHaveAttribute('data-held', 'false');
    });

    it('holds the provisioned form with saving blocked while it re-resolves', async () => {
      let repoState = view({ isProvisioned: true, repository: { ...folderlessRepo, target: 'folder' } });
      jest.mocked(useDashboardRepositoryView).mockImplementation(() => repoState);

      const { dashboard, openAndRender } = setup();
      await openAndRender({ saveAsCopy: true });
      expect(await screen.findByTestId('provisioned-form')).toHaveAttribute('data-held', 'false');

      repoState = view({
        isProvisioned: true,
        repository: { ...folderlessRepo, target: 'folder' },
        isHeld: true,
        lookup: { status: RepoViewStatus.Loading },
      });
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: 'some-folder' } });
      });

      expect(screen.getByTestId('provisioned-form')).toHaveAttribute('data-held', 'true');
      expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
    });

    it('offers the database save only at the root of a folderless repository', async () => {
      jest
        .mocked(useDashboardRepositoryView)
        .mockReturnValue(view({ isProvisioned: true, repository: folderlessRepo }));

      const { dashboard, openAndRender } = setup();
      dashboard.setState({ uid: '', version: 0 });
      await openAndRender();

      expect(await screen.findByTestId('provisioned-form')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Save to Grafana database instead' }));

      expect(
        await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)
      ).toBeInTheDocument();
      expect(screen.queryByTestId('provisioned-form')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Save to Git repository instead' }));

      expect(await screen.findByTestId('provisioned-form')).toBeInTheDocument();

      // Inside a folder the folder decides, so there is nothing to choose
      jest
        .mocked(useDashboardRepositoryView)
        .mockReturnValue(view({ isProvisioned: true, repository: folderlessRepo, folderUid: 'f1' }));
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: 'f1' } });
      });
      expect(screen.queryByRole('button', { name: /instead$/ })).not.toBeInTheDocument();
    });

    it('does not offer the database save at the root of a folder-target repository', async () => {
      jest
        .mocked(useDashboardRepositoryView)
        .mockReturnValue(view({ isProvisioned: true, repository: { ...folderlessRepo, target: 'folder' } }));

      const { dashboard, openAndRender } = setup();
      dashboard.setState({ uid: '', version: 0 });
      await openAndRender();

      expect(await screen.findByTestId('provisioned-form')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /instead$/ })).not.toBeInTheDocument();
    });

    it('holds the form through a dead-end pick and names the missing repository', async () => {
      let repoState = view({ isProvisioned: true, repository: folderlessRepo });
      jest.mocked(useDashboardRepositoryView).mockImplementation(() => repoState);

      const { dashboard, openAndRender } = setup();
      dashboard.setState({ uid: '', version: 0 });
      await openAndRender();
      expect(await screen.findByTestId('provisioned-form')).toBeInTheDocument();

      // The picked folder is annotated with a repository that no longer exists
      repoState = view({
        isProvisioned: true,
        repository: folderlessRepo,
        isHeld: true,
        lookup: { status: RepoViewStatus.Orphaned },
      });
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: 'f2' } });
      });

      expect(screen.getByTestId('provisioned-form')).toHaveAttribute('data-held', 'true');
      expect(screen.getByText('The selected folder cannot be saved to')).toBeInTheDocument();

      // ...or its lookup failed outright
      repoState = view({
        isProvisioned: true,
        repository: folderlessRepo,
        isHeld: true,
        lookup: { status: RepoViewStatus.Error, error: new Error('boom') },
      });
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: 'f3' } });
      });

      expect(screen.getByTestId('provisioned-form')).toHaveAttribute('data-held', 'true');
      expect(screen.getByText('Error loading form')).toBeInTheDocument();
      expect(screen.queryByText('The selected folder cannot be saved to')).not.toBeInTheDocument();
    });

    it('keeps the database form up while a folder picked in it resolves', async () => {
      let repoState = view({ isProvisioned: true, repository: folderlessRepo });
      jest.mocked(useDashboardRepositoryView).mockImplementation(() => repoState);

      const { dashboard, openAndRender } = setup();
      dashboard.setState({ uid: '', version: 0 });
      await openAndRender();

      expect(await screen.findByTestId('provisioned-form')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Save to Grafana database instead' }));
      const titleInput = await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput);
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'Typed');

      // The pick lands in live meta before the lookup settles; the held root view must still decide
      repoState = view({
        isProvisioned: true,
        repository: folderlessRepo,
        isHeld: true,
        lookup: { status: RepoViewStatus.Loading },
      });
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta, folderUid: 'f1' } });
      });

      expect(screen.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)).toHaveValue('Typed');
      expect(screen.queryByTestId('provisioned-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton)).toBeDisabled();
      // Enter in the title field submits through the form's onSubmit, not the button; the hold must block that path too
      mockSaveDashboard();
      await userEvent.type(titleInput, '{enter}');
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(saveDashboardMutationMock).not.toHaveBeenCalled();
      expect(screen.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)).toHaveValue('Typed');

      repoState = view({ isProvisioned: false, folderUid: 'f1' });
      act(() => {
        dashboard.setState({ meta: { ...dashboard.state.meta } });
      });

      expect(screen.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)).toHaveValue('Typed');
      expect(screen.queryByTestId('provisioned-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /instead$/ })).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton)).toBeEnabled()
      );
    });

    it("warns when a new save's first lookup already dead-ends, and still offers the database form", async () => {
      jest
        .mocked(useDashboardRepositoryView)
        .mockReturnValue(view({ status: RepoViewStatus.Orphaned, orphanedRepoName: 'ghost', isMissingRepo: true }));

      const { dashboard, openAndRender } = setup();
      dashboard.setState({ uid: '', version: 0 });
      await openAndRender();

      expect(
        await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)
      ).toBeInTheDocument();
      expect(screen.getByText('The selected folder cannot be saved to')).toBeInTheDocument();
      expect(screen.queryByTestId('provisioned-form')).not.toBeInTheDocument();
    });

    it('titles a stored provisioned dashboard as provisioned, but never a new save', async () => {
      jest
        .mocked(useDashboardRepositoryView)
        .mockReturnValue(view({ isNewSave: false, isProvisioned: true, repository: folderlessRepo }));

      const stored = setup();
      await stored.openAndRender();
      expect(await screen.findByRole('heading', { name: 'Provisioned dashboard' })).toBeInTheDocument();
      cleanup();

      jest
        .mocked(useDashboardRepositoryView)
        .mockReturnValue(view({ isProvisioned: true, repository: folderlessRepo }));

      const fresh = setup();
      fresh.dashboard.setState({ uid: '', version: 0 });
      await fresh.openAndRender();
      expect(await screen.findByRole('heading', { name: 'Save dashboard' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Save to Grafana database instead' }));
      expect(await screen.findByRole('heading', { name: 'Save dashboard' })).toBeInTheDocument();
    });
  });

  describe('Tags', () => {
    it('Should send the tags set on a new dashboard before its first save', async () => {
      const { dashboard, openAndRender } = setup();

      act(() => {
        dashboard.setState({ uid: '', version: 0, tags: ['my-tag'] });
      });

      await openAndRender();
      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.queryByLabelText('Copy tags')).not.toBeInTheDocument();

      mockSaveDashboard();
      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.dashboard.tags).toEqual(['my-tag']);
    });

    it('Should drop the source tags when saving a copy with Copy tags off', async () => {
      const { dashboard, openAndRender } = setup();

      act(() => {
        dashboard.setState({ tags: ['my-tag'] });
      });

      await openAndRender({ saveAsCopy: true });
      expect(await screen.findByText('Save dashboard copy')).toBeInTheDocument();

      mockSaveDashboard();
      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.dashboard.tags).toEqual([]);
    });

    it('Should add the source tags when saving a copy with Copy tags on', async () => {
      const { dashboard, openAndRender } = setup();

      act(() => {
        dashboard.setState({ tags: ['my-tag'] });
      });

      await openAndRender({ saveAsCopy: true });
      expect(await screen.findByText('Save dashboard copy')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Copy tags'));

      mockSaveDashboard();
      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.dashboard.tags).toEqual(['my-tag']);
    });
  });

  describe('Template save flows', () => {
    afterEach(() => {
      registerSaveAsTemplateForm(null as unknown as Parameters<typeof registerSaveAsTemplateForm>[0]);
      registerSaveDashboardTemplateForm(null as unknown as Parameters<typeof registerSaveDashboardTemplateForm>[0]);
    });

    it('renders the registered SaveAsTemplateForm when saveAsDashboardTemplate is true', async () => {
      const StubForm = (_: SaveAsTemplateFormProps) => (
        <div data-testid="stub-save-as-template-form">SaveAsTemplateForm stub</div>
      );
      registerSaveAsTemplateForm(StubForm);

      const { openAndRender } = setup();
      await openAndRender({ saveAsDashboardTemplate: true });

      expect(await screen.findByTestId('stub-save-as-template-form')).toBeInTheDocument();
      expect(await screen.findByText('Save as template')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Details/i })).toBeInTheDocument();
    });

    it('renders the registered SaveDashboardTemplateForm when saveDashboardTemplate is true', async () => {
      const StubForm = (_: SaveDashboardTemplateFormProps) => (
        <div data-testid="stub-update-template-form">SaveDashboardTemplateForm stub</div>
      );
      registerSaveDashboardTemplateForm(StubForm);

      const { openAndRender } = setup();
      await openAndRender({ saveDashboardTemplate: true });

      expect(await screen.findByTestId('stub-update-template-form')).toBeInTheDocument();
      expect(await screen.findByText('Save template')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Details/i })).toBeInTheDocument();
    });

    it('falls back to the standard save form when saveAsDashboardTemplate is true but no form is registered', async () => {
      const { openAndRender } = setup();
      await openAndRender({ saveAsDashboardTemplate: true });

      // No crash, drawer still mounts with the save-as-template title even without the extension form
      expect(await screen.findByText('Save as template')).toBeInTheDocument();
      // The standard save form should be rendered as the fallback
      expect(screen.queryByTestId('stub-save-as-template-form')).not.toBeInTheDocument();
    });
  });
});

interface MockBackendApiOptions {
  saveError: 'version-mismatch' | 'name-exists' | 'plugin-dashboard';
}

function mockSaveDashboard(options: Partial<MockBackendApiOptions> = {}) {
  saveDashboardMutationMock.mockClear();

  if (options.saveError) {
    saveDashboardMutationMock.mockResolvedValue({
      error: { status: 412, data: { status: 'version-mismatch', message: 'sad face' } },
    });

    return;
  }

  saveDashboardMutationMock.mockResolvedValue({
    data: {
      id: 10,
      uid: 'my-uid-from-resp',
      slug: 'my-slug-from-resp',
      status: 'success',
      url: 'my-url',
      version: 11,
      ...options,
    } as SaveDashboardResponseDTO,
  });
}

let cleanUp = () => {};

function setup(overrides?: Partial<DashboardSceneState>) {
  const dashboard = transformSaveModelToScene({
    dashboard: {
      title: 'hello',
      uid: 'my-uid',
      schemaVersion: 30,
      panels: [],
      version: 10,
      templating: {
        list: [
          {
            name: 'constant',
            query: 'a constant value',
            type: 'constant',
          },
        ],
      },
    },
    meta: {},
    ...overrides,
  });

  // Clear any data layers
  dashboard.setState({ $data: undefined });

  const initialSaveModel = transformSceneToSaveModel(dashboard);
  dashboard.setInitialSaveModel(initialSaveModel);

  cleanUp();
  cleanUp = dashboard.activate();

  dashboard.onEnterEditMode();

  const openAndRender = async (
    opts: { saveAsCopy?: boolean; saveAsDashboardTemplate?: boolean; saveDashboardTemplate?: boolean } = {}
  ) => {
    await dashboard.openSaveDrawer(opts);
    const drawer = dashboard.state.overlay as SaveDashboardDrawer;
    render(
      <TestProvider>
        <drawer.Component model={drawer} />
      </TestProvider>
    );

    return drawer;
  };

  //  await act(() => Promise.resolve());
  return { dashboard, openAndRender };
}
