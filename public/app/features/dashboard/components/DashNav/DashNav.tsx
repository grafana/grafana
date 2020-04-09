// Libaries
import React, { PureComponent, FC } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { e2e } from '@grafana/e2e';
// Utils & Services
import { appEvents } from 'app/core/app_events';
import { PlaylistSrv } from 'app/features/playlist/playlist_srv';
// Components
import { DashNavButton } from './DashNavButton';
import { DashNavTimeControls } from './DashNavTimeControls';
import { ModalsController, Icon } from '@grafana/ui';
import { BackButton } from 'app/core/components/BackButton/BackButton';
// State
import { updateLocation } from 'app/core/actions';
// Types
import { DashboardModel } from '../../state';
import { CoreEvents, StoreState } from 'app/types';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { SaveDashboardModalProxy } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardModalProxy';
import { sanitizeUrl } from 'app/core/utils/text';

export interface OwnProps {
  dashboard: DashboardModel;
  isFullscreen: boolean;
  $injector: any;
  updateLocation: typeof updateLocation;
  onAddPanel: () => void;
}

const customNavbarContent: Array<FC<Partial<OwnProps>>> = [];

export function addNavbarContent(content: FC<Partial<OwnProps>>) {
  customNavbarContent.push(content);
}

export interface StateProps {
  location: any;
}

type Props = StateProps & OwnProps;

class DashNav extends PureComponent<Props> {
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
    this.props.updateLocation({
      query: { edit: null, viewPanel: null },
      partial: true,
    });
  };

  onToggleTVMode = () => {
    appEvents.emit(CoreEvents.toggleKioskMode);
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

  renderDashboardTitleSearchButton() {
    const { dashboard, isFullscreen } = this.props;
    /* Hard-coded value so we don't have to wrap whole component in withTheme because of 1 variable */
    const iconClassName = css`
      margin-right: 8px;
      margin-bottom: -1px;
    `;
    const mainIconClassName = css`
      margin-right: 8px;
    `;

    const folderTitle = dashboard.meta.folderTitle;
    const haveFolder = dashboard.meta.folderId > 0;

    return (
      <>
        <div>
          <div className="navbar-page-btn">
            {!isFullscreen && <Icon name="apps" size="xl" className={mainIconClassName} />}
            {haveFolder && (
              <>
                <a className="navbar-page-btn__folder" onClick={this.onFolderNameClick}>
                  {folderTitle}
                </a>
                <Icon name="angle-right" className={iconClassName} />
              </>
            )}
            <a onClick={this.onDahboardNameClick}>
              {dashboard.title} <Icon name="angle-down" className={iconClassName} />
            </a>
          </div>
        </div>
        <div className="navbar__spacer" />
      </>
    );
  }

  renderBackButton() {
    return (
      <div className="navbar-edit">
        <BackButton onClick={this.onClose} aria-label={e2e.pages.Dashboard.Toolbar.selectors.backArrow} />
      </div>
    );
  }

  render() {
    const { dashboard, onAddPanel, location, isFullscreen } = this.props;
    const { canStar, canSave, canShare, showSettings, isStarred } = dashboard.meta;
    const { snapshot } = dashboard;
    const snapshotUrl = snapshot && snapshot.originalUrl;

    return (
      <div className="navbar">
        {isFullscreen && this.renderBackButton()}
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

        {customNavbarContent.map((Component, index) => (
          <Component {...this.props} key={`navbar-custom-content-${index}`} />
        ))}

        <div className="navbar-buttons navbar-buttons--actions">
          {canSave && (
            <DashNavButton
              classSuffix="save"
              tooltip="Add panel"
              icon="panel-add"
              onClick={onAddPanel}
              iconType="mono"
              iconSize="xl"
            />
          )}

          {canStar && (
            <DashNavButton
              tooltip="Mark as favorite"
              classSuffix="star"
              icon={isStarred ? 'favorite' : 'star'}
              iconType={isStarred ? 'mono' : 'default'}
              onClick={this.onStarDashboard}
            />
          )}

          {canShare && (
            <ModalsController>
              {({ showModal, hideModal }) => (
                <DashNavButton
                  tooltip="Share dashboard"
                  classSuffix="share"
                  icon="share-alt"
                  onClick={() => {
                    showModal(ShareModal, {
                      dashboard,
                      onDismiss: hideModal,
                    });
                  }}
                />
              )}
            </ModalsController>
          )}

          {canSave && (
            <ModalsController>
              {({ showModal, hideModal }) => (
                <DashNavButton
                  tooltip="Save dashboard"
                  classSuffix="save"
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
          )}

          {snapshotUrl && (
            <DashNavButton
              tooltip="Open original dashboard"
              classSuffix="snapshot-origin"
              icon="link"
              href={sanitizeUrl(snapshotUrl)}
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
            <DashNavTimeControls dashboard={dashboard} location={location} updateLocation={updateLocation} />
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
