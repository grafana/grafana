import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { ShowConfirmModalEvent } from 'app/types/events';

import { config } from '../../../../core/config';
import { grantUserPermissions } from '../../../alerting/unified/mocks';
import { DashboardScene, DashboardSceneState } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import ShareMenu from './ShareMenu';

const createAndCopyDashboardShortLinkMock = jest.fn();
jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createAndCopyDashboardShortLink: () => createAndCopyDashboardShortLinkMock(),
}));

const selector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    partial: jest.fn(),
    getLocation: jest.fn().mockReturnValue({ pathname: '/d/dash-1', search: '' }),
  },
}));

describe('ShareMenu', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should render menu items', async () => {
    Object.defineProperty(contextSrv, 'isSignedIn', {
      value: true,
    });
    grantUserPermissions([AccessControlAction.SnapshotsCreate, AccessControlAction.OrgUsersAdd]);

    config.publicDashboardsEnabled = true;
    config.snapshotEnabled = true;
    config.externalUserMngLinkUrl = 'http://localhost:3000';
    setup({ meta: { canEdit: true } });

    expect(await screen.findByTestId(selector.shareInternally)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.shareExternally)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.shareSnapshot)).toBeInTheDocument();
  });

  it('should not share externally when public dashboard is disabled', async () => {
    config.publicDashboardsEnabled = false;
    setup();

    expect(screen.queryByTestId(selector.shareExternally)).not.toBeInTheDocument();
  });

  describe('ShareSnapshot', () => {
    it('should not share snapshot when user is not signed in', async () => {
      config.snapshotEnabled = true;
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: false,
      });
      setup({ meta: { canEdit: true } });

      expect(screen.queryByTestId(selector.shareSnapshot)).not.toBeInTheDocument();
    });
    it('should not share snapshot when snapshot is not enabled', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      config.snapshotEnabled = false;
      setup({ meta: { canEdit: true } });

      expect(screen.queryByTestId(selector.shareSnapshot)).not.toBeInTheDocument();
    });
    it('should not share snapshot without permissions', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      config.snapshotEnabled = true;
      setup({ meta: { canEdit: false } });

      expect(screen.queryByTestId(selector.shareSnapshot)).not.toBeInTheDocument();
    });
  });

  describe('Save confirmation modal', () => {
    beforeEach(() => {
      jest.spyOn(appEvents, 'publish');
      jest.spyOn(locationService, 'partial');
    });

    it('should show save confirmation modal when dashboard is editing and dirty', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      grantUserPermissions([AccessControlAction.SnapshotsCreate]);

      setup({ isEditing: true, isDirty: true, meta: { canEdit: true } });

      const shareInternallyButton = await screen.findByTestId(selector.shareInternally);
      fireEvent.click(shareInternallyButton);

      await waitFor(() => {
        expect(appEvents.publish).toHaveBeenCalledWith(expect.any(ShowConfirmModalEvent));
      });

      const modalCall = (appEvents.publish as jest.Mock).mock.calls.find(
        (call) => call[0] instanceof ShowConfirmModalEvent
      );
      expect(modalCall).toBeDefined();

      const modalEvent = modalCall![0] as ShowConfirmModalEvent;
      expect(modalEvent.payload.title).toBe('Save changes to dashboard?');
      expect(modalEvent.payload.text).toContain('You have unsaved changes');
      expect(modalEvent.payload.yesText).toBe('Save');
      expect(modalEvent.payload.noText).toBe('Discard');

      expect(locationService.partial).not.toHaveBeenCalled();
    });

    it('should navigate directly when dashboard is not editing', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      grantUserPermissions([AccessControlAction.SnapshotsCreate]);

      setup({ isEditing: false, isDirty: false, meta: { canEdit: true } });

      const shareInternallyButton = await screen.findByTestId(selector.shareInternally);
      fireEvent.click(shareInternallyButton);

      await waitFor(() => {
        expect(locationService.partial).toHaveBeenCalledWith({ shareView: 'link' });
      });

      expect(appEvents.publish).not.toHaveBeenCalled();
    });

    it('should navigate directly when dashboard is editing but not dirty', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      grantUserPermissions([AccessControlAction.SnapshotsCreate]);

      setup({ isEditing: true, isDirty: false, meta: { canEdit: true } });

      const shareInternallyButton = await screen.findByTestId(selector.shareInternally);
      fireEvent.click(shareInternallyButton);

      await waitFor(() => {
        expect(locationService.partial).toHaveBeenCalledWith({ shareView: 'link' });
      });

      expect(appEvents.publish).not.toHaveBeenCalled();
    });

    it('should call onSaveSuccess callback after saving', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      grantUserPermissions([AccessControlAction.SnapshotsCreate]);

      const dashboard = setup({ isEditing: true, isDirty: true, meta: { canEdit: true } });
      const openSaveDrawerSpy = jest.spyOn(dashboard, 'openSaveDrawer').mockImplementation(() => {});

      const shareInternallyButton = await screen.findByTestId(selector.shareInternally);
      fireEvent.click(shareInternallyButton);

      await waitFor(() => {
        expect(appEvents.publish).toHaveBeenCalledWith(expect.any(ShowConfirmModalEvent));
      });

      const modalCall = (appEvents.publish as jest.Mock).mock.calls.find(
        (call) => call[0] instanceof ShowConfirmModalEvent
      );
      const modalEvent = modalCall![0] as ShowConfirmModalEvent;

      // Simulate clicking "Save" button
      modalEvent.payload.onConfirm?.();

      expect(openSaveDrawerSpy).toHaveBeenCalledWith({
        onSaveSuccess: expect.any(Function),
      });

      // Simulate save success callback
      const onSaveSuccess = openSaveDrawerSpy.mock.calls[0][0].onSaveSuccess;
      if (onSaveSuccess) {
        onSaveSuccess();
      }

      expect(locationService.partial).toHaveBeenCalledWith({ shareView: 'link' });
    });
  });
});

function setup(overrides?: Partial<DashboardSceneState>) {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
  });

  const dashboard = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
    ...overrides,
  });

  render(<ShareMenu dashboard={dashboard} />);
  return dashboard;
}
