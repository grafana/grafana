// Libaries
import React, { FC, PureComponent, ReactNode } from 'react';
import { connect, MapDispatchToProps } from 'react-redux';
// Utils & Services
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
// Components
import { DashNavTimeControls } from './DashNavTimeControls';
import { ButtonGroup, ModalsController, ToolbarButton } from '@grafana/ui';
import { locationUtil, textUtil } from '@grafana/data';
// State
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
// Types
import { DashboardModel } from '../../state';
import { StoreState } from 'app/types';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { SaveDashboardModalProxy } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardModalProxy';
import { locationService } from '@grafana/runtime';
import { getDashboardSrv } from '../../services/DashboardSrv';
import { PageToolbarHidableInDisplayProfile, HidableInDisplayProfile } from '../../displayProfiles/components';
import { ToggleDisplayProfile } from '../../displayProfiles/state/hooks';
import { DashNavButton } from './DashNavButton';

export interface OwnProps {
  dashboard: DashboardModel;
  isFullscreen: boolean;
  hideTimePicker: boolean;
  folderTitle?: string;
  title: string;
  onAddPanel: () => void;
}

interface DispatchProps {
  updateTimeZoneForSession: typeof updateTimeZoneForSession;
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

type Props = OwnProps & DispatchProps;

class DashNav extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  onClose = () => {
    locationService.partial({ viewPanel: null });
  };

  onOpenSettings = () => {
    locationService.partial({ editview: 'settings' });
  };

  onStarDashboard = () => {
    const { dashboard } = this.props;
    const dashboardSrv = getDashboardSrv();

    dashboardSrv.starDashboard(dashboard.id, dashboard.meta.isStarred).then((newState: any) => {
      dashboard.meta.isStarred = newState;
      this.forceUpdate();
    });
  };

  onPlaylistPrev = () => {
    playlistSrv.prev();
  };

  onPlaylistNext = () => {
    playlistSrv.next();
  };

  onPlaylistStop = () => {
    playlistSrv.stop();
    this.forceUpdate();
  };

  addCustomContent(actions: DashNavButtonModel[], buttons: ReactNode[]) {
    actions.map((action, index) => {
      const Component = action.component;
      const element = <Component {...this.props} key={`button-custom-${index}`} />;
      typeof action.index === 'number' ? buttons.splice(action.index, 0, element) : buttons.push(element);
    });
  }

  isPlaylistRunning() {
    return playlistSrv.isPlaying;
  }

  renderLeftActionsButton() {
    const { dashboard } = this.props;
    const { canStar, canShare, isStarred } = dashboard.meta;
    const buttons: ReactNode[] = [];

    if (this.isPlaylistRunning()) {
      return [];
    }

    if (canStar) {
      buttons.push(
        <HidableInDisplayProfile pathInProfile="dashNav.starToggle" key="button-star">
          <DashNavButton
            tooltip="Mark as favorite"
            icon={isStarred ? 'favorite' : 'star'}
            iconType={isStarred ? 'mono' : 'default'}
            iconSize="lg"
            onClick={this.onStarDashboard}
          />
        </HidableInDisplayProfile>
      );
    }

    if (canShare) {
      buttons.push(
        <HidableInDisplayProfile pathInProfile="dashNav.sharePanelToggle" key="button-share">
          <ModalsController>
            {({ showModal, hideModal }) => (
              <DashNavButton
                tooltip="Share dashboard or panel"
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
        </HidableInDisplayProfile>
      );
    }

    this.addCustomContent(customLeftActions, buttons);
    return buttons;
  }

  renderPlaylistControls() {
    return (
      <ButtonGroup key="playlist-buttons">
        <ToolbarButton tooltip="Go to previous dashboard" icon="backward" onClick={this.onPlaylistPrev} narrow />
        <ToolbarButton onClick={this.onPlaylistStop}>Stop playlist</ToolbarButton>
        <ToolbarButton tooltip="Go to next dashboard" icon="forward" onClick={this.onPlaylistNext} narrow />
      </ButtonGroup>
    );
  }

  renderTimeControls() {
    const { dashboard, updateTimeZoneForSession, hideTimePicker } = this.props;

    if (hideTimePicker) {
      return null;
    }

    return (
      <HidableInDisplayProfile pathInProfile="dashNav.timePicker" key="time-controls">
        <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={updateTimeZoneForSession} />
      </HidableInDisplayProfile>
    );
  }

  renderRightActionsButton() {
    const { dashboard, onAddPanel, isFullscreen } = this.props;
    const { canEdit, showSettings } = dashboard.meta;
    const { snapshot } = dashboard;
    const snapshotUrl = snapshot && snapshot.originalUrl;
    const buttons: ReactNode[] = [];

    if (this.isPlaylistRunning()) {
      return [this.renderPlaylistControls(), this.renderTimeControls()];
    }

    if (canEdit && !isFullscreen) {
      buttons.push(
        <HidableInDisplayProfile pathInProfile="dashNav.addPanelToggle" key="button-panel-add">
          <ToolbarButton tooltip="Add panel" icon="panel-add" onClick={onAddPanel} />
        </HidableInDisplayProfile>
      );
      buttons.push(
        <HidableInDisplayProfile pathInProfile="dashNav.saveDashboardToggle" key="button-save">
          <ModalsController>
            {({ showModal, hideModal }) => (
              <ToolbarButton
                tooltip="Save dashboard"
                icon="save"
                onClick={() => {
                  showModal(SaveDashboardModalProxy, {
                    dashboard,
                    onDismiss: hideModal,
                  });
                }}
              />
            )}
          </ModalsController>
        </HidableInDisplayProfile>
      );
    }

    if (snapshotUrl) {
      buttons.push(
        <HidableInDisplayProfile pathInProfile="dashNav.snapshotToggle" key="button-snapshot">
          <ToolbarButton
            tooltip="Open original dashboard"
            onClick={() => this.gotoSnapshotOrigin(snapshotUrl)}
            icon="link"
          />
        </HidableInDisplayProfile>
      );
    }

    if (showSettings) {
      buttons.push(
        <HidableInDisplayProfile pathInProfile="dashNav.dashboardSettingsToggle" key="button-settings">
          <ToolbarButton tooltip="Dashboard settings" icon="cog" onClick={this.onOpenSettings} />
        </HidableInDisplayProfile>
      );
    }

    this.addCustomContent(customRightActions, buttons);

    buttons.push(this.renderTimeControls());
    buttons.push(
      <HidableInDisplayProfile pathInProfile="dashNav.tvToggle" key="tv-button">
        <ToggleDisplayProfile>
          {(onToggle) => <ToolbarButton tooltip="Cycle view mode" icon="monitor" onClick={onToggle} />}
        </ToggleDisplayProfile>
      </HidableInDisplayProfile>
    );
    return buttons;
  }

  gotoSnapshotOrigin(snapshotUrl: string) {
    window.location.href = textUtil.sanitizeUrl(snapshotUrl);
  }

  render() {
    const { isFullscreen, title, folderTitle } = this.props;
    const onGoBack = isFullscreen ? this.onClose : undefined;

    const titleHref = locationUtil.updateSearchParams(window.location.href, '?search=open');
    const parentHref = locationUtil.updateSearchParams(window.location.href, '?search=open&folder=current');

    return (
      <PageToolbarHidableInDisplayProfile
        pageIcon={isFullscreen ? undefined : 'apps'}
        title={title}
        parent={folderTitle}
        titleHref={titleHref}
        parentHref={parentHref}
        onGoBack={onGoBack}
        leftItems={this.renderLeftActionsButton()}
      >
        {this.renderRightActionsButton()}
      </PageToolbarHidableInDisplayProfile>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  updateTimeZoneForSession,
};

export default connect(mapStateToProps, mapDispatchToProps)(DashNav);
