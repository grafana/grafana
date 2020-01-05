// Libaries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { e2e } from '@grafana/e2e';
// Utils & Services
import { appEvents } from 'app/core/app_events';
import { PlaylistSrv } from 'app/features/playlist/playlist_srv';
// Components
import { DashNavButton } from './DashNavButton';
import { DashNavTimeControls } from './DashNavTimeControls';
import { Tooltip } from '@grafana/ui';
import { Unicon } from '@grafana/ui/src/components/Icon/Unicon';
// State
import { updateLocation } from 'app/core/actions';
// Types
import { DashboardModel } from '../../state';
import { CoreEvents, StoreState } from 'app/types';

export interface OwnProps {
  dashboard: DashboardModel;
  editview: string;
  isEditing: boolean;
  isFullscreen: boolean;
  $injector: any;
  updateLocation: typeof updateLocation;
  onAddPanel: () => void;
}

export interface StateProps {
  location: any;
}

type Props = StateProps & OwnProps;

export class DashNav extends PureComponent<Props> {
  playlistSrv: PlaylistSrv;

  constructor(props: Props) {
    super(props);
    this.playlistSrv = this.props.$injector.get('playlistSrv');
  }

  onDahboardNameClick = () => {
    appEvents.emit(CoreEvents.showDashSearch);
  };

  onFolderNameClick = () => {
    appEvents.emit(CoreEvents.showDashSearch, {
      query: 'folder:current',
    });
  };

  onClose = () => {
    if (this.props.editview) {
      this.props.updateLocation({
        query: { editview: null },
        partial: true,
      });
    } else {
      this.props.updateLocation({
        query: { panelId: null, edit: null, fullscreen: null, tab: null },
        partial: true,
      });
    }
  };

  onToggleTVMode = () => {
    appEvents.emit(CoreEvents.toggleKioskMode);
  };

  onSave = () => {
    const { $injector } = this.props;
    const dashboardSrv = $injector.get('dashboardSrv');
    dashboardSrv.saveDashboard();
  };

  onOpenSettings = () => {
    this.props.updateLocation({
      query: { editview: 'settings' },
      partial: true,
    });
  };

  onStarDashboard = () => {
    const { dashboard, $injector } = this.props;
    const dashboardSrv = $injector.get('dashboardSrv');

    dashboardSrv.starDashboard(dashboard.id, dashboard.meta.isStarred).then((newState: any) => {
      dashboard.meta.isStarred = newState;
      this.forceUpdate();
    });
  };

  onPlaylistPrev = () => {
    this.playlistSrv.prev();
  };

  onPlaylistNext = () => {
    this.playlistSrv.next();
  };

  onPlaylistStop = () => {
    this.playlistSrv.stop();
    this.forceUpdate();
  };

  onOpenShare = () => {
    const $rootScope = this.props.$injector.get('$rootScope');
    const modalScope = $rootScope.$new();
    modalScope.tabIndex = 0;
    modalScope.dashboard = this.props.dashboard;

    appEvents.emit(CoreEvents.showModal, {
      src: 'public/app/features/dashboard/components/ShareModal/template.html',
      scope: modalScope,
    });
  };

  renderDashboardTitleSearchButton() {
    const { dashboard } = this.props;

    const folderTitle = dashboard.meta.folderTitle;
    const haveFolder = dashboard.meta.folderId > 0;

    return (
      <>
        <div>
          <div className="navbar-page-btn">
            {!this.isInFullscreenOrSettings && <Unicon name="dashboard" />}
            {haveFolder && (
              <>
                <a className="navbar-page-btn__folder" onClick={this.onFolderNameClick}>
                  {folderTitle}
                </a>
                <Unicon name="angle-right" className="navbar-page-btn__folder-icon" />
              </>
            )}
            <a onClick={this.onDahboardNameClick}>
              {dashboard.title} <Unicon className="navbar-page-btn__search" name="angle-down" />
            </a>
          </div>
        </div>
        {this.isSettings && <span className="navbar-settings-title">&nbsp;/ Settings</span>}
        <div className="navbar__spacer" />
      </>
    );
  }

  get isInFullscreenOrSettings() {
    return this.props.editview || this.props.isFullscreen;
  }

  get isSettings() {
    return this.props.editview;
  }

  renderBackButton() {
    return (
      <div className="navbar-edit">
        <Tooltip content="Go back (Esc)">
          <button
            className="navbar-edit__back-btn"
            onClick={this.onClose}
            aria-label={e2e.pages.Dashboard.selectors.backArrow}
          >
            <Unicon name="arrow-left" />
          </button>
        </Tooltip>
      </div>
    );
  }

  render() {
    const { dashboard, onAddPanel, location, $injector } = this.props;
    const { canStar, canSave, canShare, showSettings, isStarred } = dashboard.meta;
    const { snapshot } = dashboard;
    const snapshotUrl = snapshot && snapshot.originalUrl;
    return (
      <div className="navbar">
        {this.isInFullscreenOrSettings && this.renderBackButton()}
        {this.renderDashboardTitleSearchButton()}

        {this.playlistSrv.isPlaying && (
          <div className="navbar-buttons navbar-buttons--playlist">
            <DashNavButton
              tooltip="Go to previous dashboard"
              classSuffix="tight"
              icon="step-backward"
              onClick={this.onPlaylistPrev}
            />
            <DashNavButton
              tooltip="Stop playlist"
              classSuffix="tight"
              icon="square-shape"
              onClick={this.onPlaylistStop}
            />
            <DashNavButton
              tooltip="Go to next dashboard"
              classSuffix="tight"
              icon="forward"
              onClick={this.onPlaylistNext}
            />
          </div>
        )}

        <div className="navbar-buttons navbar-buttons--actions">
          {canSave && (
            <DashNavButton tooltip="Add panel" classSuffix="add-panel" icon="focus-add" onClick={onAddPanel} />
          )}

          {canStar && (
            <DashNavButton
              tooltip="Mark as favorite"
              classSuffix="star"
              icon={`${isStarred ? 'favorite' : 'star'}`}
              onClick={this.onStarDashboard}
            />
          )}

          {canShare && (
            <DashNavButton tooltip="Share dashboard" classSuffix="share" icon="share" onClick={this.onOpenShare} />
          )}

          {canSave && (
            <DashNavButton tooltip="Save dashboard" classSuffix="save" icon="file-check" onClick={this.onSave} />
          )}

          {snapshotUrl && (
            <DashNavButton
              tooltip="Open original dashboard"
              classSuffix="snapshot-origin"
              icon="link-alt"
              href={snapshotUrl}
            />
          )}

          {showSettings && (
            <DashNavButton
              tooltip="Dashboard settings"
              classSuffix="settings"
              icon="cog"
              onClick={this.onOpenSettings}
            />
          )}
        </div>

        <div className="navbar-buttons navbar-buttons--tv">
          <DashNavButton tooltip="Cycle view mode" classSuffix="tv" icon="monitor" onClick={this.onToggleTVMode} />
        </div>

        {!dashboard.timepicker.hidden && (
          <div className="navbar-buttons">
            <DashNavTimeControls
              $injector={$injector}
              dashboard={dashboard}
              location={location}
              updateLocation={updateLocation}
            />
          </div>
        )}
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  location: state.location,
});

const mapDispatchToProps = {
  updateLocation,
};

export default connect(mapStateToProps, mapDispatchToProps)(DashNav);
