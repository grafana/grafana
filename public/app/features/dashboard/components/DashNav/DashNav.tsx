import React, { FC, ReactNode } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { locationUtil, textUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ButtonGroup, ModalsController, ToolbarButton, PageToolbar, useForceUpdate, Tag } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbarSeparator';
import config from 'app/core/config';
import { toggleKioskMode } from 'app/core/navigation/kiosk';
import { DashboardCommentsModal } from 'app/features/dashboard/components/DashboardComments/DashboardCommentsModal';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { KioskMode } from 'app/types';

import { setStarred } from '../../../../core/reducers/navBarTree';
import { getDashboardSrv } from '../../services/DashboardSrv';
import { DashboardModel } from '../../state';

import { DashNavButton } from './DashNavButton';
import { DashNavTimeControls } from './DashNavTimeControls';

const mapDispatchToProps = {
  setStarred,
  updateTimeZoneForSession,
};

const connector = connect(null, mapDispatchToProps);

export interface OwnProps {
  dashboard: DashboardModel;
  isFullscreen: boolean;
  kioskMode: KioskMode;
  hideTimePicker: boolean;
  folderTitle?: string;
  title: string;
  onAddPanel: () => void;
}

interface DashNavButtonModel {
  show: (props: Props) => boolean;
  component: FC<Partial<Props>>;
  index?: number | 'end';
}

const customLeftActions: DashNavButtonModel[] = [];
const customRightActions: DashNavButtonModel[] = [];

export function addCustomLeftAction(content: DashNavButtonModel) {
  customLeftActions.push(content);
}

export function addCustomRightAction(content: DashNavButtonModel) {
  customRightActions.push(content);
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const DashNav = React.memo<Props>((props) => {
  const forceUpdate = useForceUpdate();

  const onStarDashboard = () => {
    const dashboardSrv = getDashboardSrv();
    const { dashboard, setStarred } = props;

    dashboardSrv.starDashboard(dashboard.id, dashboard.meta.isStarred).then((newState: any) => {
      setStarred({ id: dashboard.uid, title: dashboard.title, url: dashboard.meta.url ?? '', isStarred: newState });
      dashboard.meta.isStarred = newState;
      forceUpdate();
    });
  };

  const onClose = () => {
    locationService.partial({ viewPanel: null });
  };

  const onToggleTVMode = () => {
    toggleKioskMode();
  };

  const onOpenSettings = () => {
    locationService.partial({ editview: 'settings' });
  };

  const onPlaylistPrev = () => {
    playlistSrv.prev();
  };

  const onPlaylistNext = () => {
    playlistSrv.next();
  };

  const onPlaylistStop = () => {
    playlistSrv.stop();
    forceUpdate();
  };

  const addCustomContent = (actions: DashNavButtonModel[], buttons: ReactNode[]) => {
    actions.map((action, index) => {
      const Component = action.component;
      const element = <Component {...props} key={`button-custom-${index}`} />;
      typeof action.index === 'number' ? buttons.splice(action.index, 0, element) : buttons.push(element);
    });
  };

  const isPlaylistRunning = () => {
    return playlistSrv.isPlaying;
  };

  const renderLeftActions = () => {
    const { dashboard, kioskMode } = props;
    const { canStar, canShare, isStarred } = dashboard.meta;
    const buttons: ReactNode[] = [];

    if (kioskMode !== KioskMode.Off || isPlaylistRunning()) {
      return [];
    }

    if (canStar) {
      let desc = isStarred ? 'Unmark as favorite' : 'Mark as favorite';
      buttons.push(
        <DashNavButton
          tooltip={desc}
          icon={isStarred ? 'favorite' : 'star'}
          iconType={isStarred ? 'mono' : 'default'}
          iconSize="lg"
          onClick={onStarDashboard}
          key="button-star"
        />
      );
    }

    if (canShare) {
      let desc = 'Share dashboard or panel';
      buttons.push(
        <ModalsController key="button-share">
          {({ showModal, hideModal }) => (
            <DashNavButton
              tooltip={desc}
              icon="share-alt"
              iconSize="lg"
              onClick={() => {
                showModal(ShareModal, {
                  dashboard,
                  onDismiss: hideModal,
                });
              }}
            />
          )}
        </ModalsController>
      );
    }

    if (dashboard.meta.publicDashboardEnabled) {
      buttons.push(<Tag name="Public" colorIndex={5}></Tag>);
    }

    if (dashboard.uid && config.featureToggles.dashboardComments) {
      buttons.push(
        <ModalsController key="button-dashboard-comments">
          {({ showModal, hideModal }) => (
            <DashNavButton
              tooltip="Show dashboard comments"
              icon="comment-alt-message"
              iconSize="lg"
              onClick={() => {
                showModal(DashboardCommentsModal, {
                  dashboard,
                  onDismiss: hideModal,
                });
              }}
            />
          )}
        </ModalsController>
      );
    }

    addCustomContent(customLeftActions, buttons);
    return buttons;
  };

  const renderPlaylistControls = () => {
    return (
      <ButtonGroup key="playlist-buttons">
        <ToolbarButton tooltip="Go to previous dashboard" icon="backward" onClick={onPlaylistPrev} narrow />
        <ToolbarButton onClick={onPlaylistStop}>Stop playlist</ToolbarButton>
        <ToolbarButton tooltip="Go to next dashboard" icon="forward" onClick={onPlaylistNext} narrow />
      </ButtonGroup>
    );
  };

  const renderTimeControls = () => {
    const { dashboard, updateTimeZoneForSession, hideTimePicker } = props;

    if (hideTimePicker) {
      return null;
    }

    return (
      <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={updateTimeZoneForSession} key="time-controls" />
    );
  };

  const renderRightActions = () => {
    const { dashboard, onAddPanel, isFullscreen, kioskMode } = props;
    const { canSave, canEdit, showSettings } = dashboard.meta;
    const { snapshot } = dashboard;
    const snapshotUrl = snapshot && snapshot.originalUrl;
    const buttons: ReactNode[] = [];
    const tvButton = (
      <ToolbarButton tooltip="Cycle view mode" icon="monitor" onClick={onToggleTVMode} key="tv-button" />
    );

    if (isPlaylistRunning()) {
      return [renderPlaylistControls(), renderTimeControls()];
    }

    if (kioskMode === KioskMode.TV) {
      return [renderTimeControls(), tvButton];
    }

    if (canEdit && !isFullscreen) {
      buttons.push(<ToolbarButton tooltip="Add panel" icon="panel-add" onClick={onAddPanel} key="button-panel-add" />);
    }

    if (canSave && !isFullscreen) {
      buttons.push(
        <ModalsController key="button-save">
          {({ showModal, hideModal }) => (
            <ToolbarButton
              tooltip="Save dashboard"
              icon="save"
              onClick={() => {
                showModal(SaveDashboardDrawer, {
                  dashboard,
                  onDismiss: hideModal,
                });
              }}
            />
          )}
        </ModalsController>
      );
    }

    if (snapshotUrl) {
      buttons.push(
        <ToolbarButton
          tooltip="Open original dashboard"
          onClick={() => gotoSnapshotOrigin(snapshotUrl)}
          icon="link"
          key="button-snapshot"
        />
      );
    }

    if (showSettings) {
      buttons.push(
        <ToolbarButton tooltip="Dashboard settings" icon="cog" onClick={onOpenSettings} key="button-settings" />
      );
    }

    addCustomContent(customRightActions, buttons);

    buttons.push(renderTimeControls());
    buttons.push(tvButton);
    return buttons;
  };

  const gotoSnapshotOrigin = (snapshotUrl: string) => {
    window.location.href = textUtil.sanitizeUrl(snapshotUrl);
  };

  const { isFullscreen, title, folderTitle } = props;
  // this ensures the component rerenders when the location changes
  const location = useLocation();
  const titleHref = locationUtil.getUrlForPartial(location, { search: 'open' });
  const parentHref = locationUtil.getUrlForPartial(location, { search: 'open', folder: 'current' });
  const onGoBack = isFullscreen ? onClose : undefined;

  if (config.featureToggles.topnav) {
    return (
      <AppChromeUpdate
        pageNav={{ text: title }}
        actions={
          <>
            {renderLeftActions()}
            <NavToolbarSeparator leftActionsSeparator />
            {renderRightActions()}
          </>
        }
      />
    );
  }

  return (
    <PageToolbar
      pageIcon={isFullscreen ? undefined : 'apps'}
      title={title}
      parent={folderTitle}
      titleHref={titleHref}
      parentHref={parentHref}
      onGoBack={onGoBack}
      leftItems={renderLeftActions()}
    >
      {renderRightActions()}
    </PageToolbar>
  );
});

DashNav.displayName = 'DashNav';

export default connector(DashNav);
