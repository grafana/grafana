// Libaries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

// Utils & Services
import { appEvents } from 'app/core/app_events';

// Components
import { DashNavButton } from './DashNavButton';

// State
import { updateLocation } from 'app/core/actions';

// Types
import { DashboardModel } from '../../state/DashboardModel';

export interface Props {
  dashboard: DashboardModel;
  editview: string;
  isEditing: boolean;
  isFullscreen: boolean;
  $injector: any;
  updateLocation: typeof updateLocation;
}

export class DashNav extends PureComponent<Props> {
  onOpenSearch = () => {
    appEvents.emit('show-dash-search');
  };

  onAddPanel = () => {
    const { dashboard } = this.props;

    // Return if the "Add panel" exists already
    if (dashboard.panels.length > 0 && dashboard.panels[0].type === 'add-panel') {
      return;
    }

    dashboard.addPanel({
      type: 'add-panel',
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
      title: 'Panel Title',
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
        query: { panelId: null, edit: null, fullscreen: null },
        partial: true,
      });
    }
  };

  onToggleTVMode = () => {
    appEvents.emit('toggle-kiosk-mode');
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
    const { $injector, dashboard } = this.props;
    const dashboardSrv = $injector.get('dashboardSrv');

    dashboardSrv.starDashboard(dashboard.id, dashboard.meta.isStarred).then(newState => {
      dashboard.meta.isStarred = newState;
      this.forceUpdate();
    });
  };

  onOpenShare = () => {
    const $rootScope = this.props.$injector.get('$rootScope');
    const modalScope = $rootScope.$new();
    modalScope.tabIndex = 0;
    modalScope.dashboard = this.props.dashboard;

    appEvents.emit('show-modal', {
      src: 'public/app/features/dashboard/components/ShareModal/template.html',
      scope: modalScope,
    });
  };

  render() {
    const { dashboard, isFullscreen, editview } = this.props;
    const { canEdit, canStar, canSave, canShare, folderTitle, showSettings, isStarred } = dashboard.meta;
    const { snapshot } = dashboard;

    const haveFolder = dashboard.meta.folderId > 0;
    const snapshotUrl = snapshot && snapshot.originalUrl;

    return (
      <div className="navbar">
        <div>
          <a className="navbar-page-btn" onClick={this.onOpenSearch}>
            <i className="gicon gicon-dashboard" />
            {haveFolder && <span className="navbar-page-btn--folder">{folderTitle} / </span>}
            {dashboard.title}
            <i className="fa fa-caret-down" />
          </a>
        </div>

        <div className="navbar__spacer" />
        {/*
        <div class="navbar-buttons navbar-buttons--playlist" ng-if="ctrl.playlistSrv.isPlaying">
          <a class="navbar-button navbar-button--tight" ng-click="ctrl.playlistSrv.prev()"><i class="fa fa-step-backward"></i></a>
          <a class="navbar-button navbar-button--tight" ng-click="ctrl.playlistSrv.stop()"><i class="fa fa-stop"></i></a>
          <a class="navbar-button navbar-button--tight" ng-click="ctrl.playlistSrv.next()"><i class="fa fa-step-forward"></i></a>
        </div>
        */}

        <div className="navbar-buttons navbar-buttons--actions">
          {canEdit && (
            <DashNavButton
              tooltip="Add panel"
              classSuffix="add-panel"
              icon="gicon gicon-add-panel"
              onClick={this.onAddPanel}
            />
          )}

          {canStar && (
            <button
              className="btn navbar-button navbar-button--star"
              onClick={this.onStarDashboard}
              title="Mark as favorite"
            >
              {isStarred && <i className="fa fa-star" />}
              {!isStarred && <i className="fa fa-star-o" />}
            </button>
          )}

          {canShare && (
            <button
              className="btn navbar-button navbar-button--share"
              onClick={this.onOpenShare}
              title="Share Dashboard"
            >
              <i className="fa fa-share-square-o" />
            </button>
          )}

          {canSave && (
            <button
              className="btn navbar-button navbar-button--save"
              onClick={this.onSave}
              title="Save dashboard <br> CTRL+S"
            >
              <i className="fa fa-save" />
            </button>
          )}

          {snapshotUrl && (
            <a
              className="btn navbar-button navbar-button--snapshot-origin"
              href={snapshotUrl}
              title="Open original dashboard"
            >
              <i className="fa fa-link" />
            </a>
          )}

          {showSettings && (
            <button
              className="btn navbar-button navbar-button--settings"
              onClick={this.onOpenSettings}
              title="Dashboard Settings"
            >
              <i className="fa fa-cog" />
            </button>
          )}
        </div>

        <div className="navbar-buttons navbar-buttons--tv">
          <button className="btn navbar-button navbar-button--tv" onClick={this.onToggleTVMode} title="Cycle view mode">
            <i className="fa fa-desktop" />
          </button>
        </div>

        {
          // <gf-time-picker class="gf-timepicker-nav" dashboard="ctrl.dashboard" ng-if="!ctrl.dashboard.timepicker.hidden"></gf-time-picker>
        }

        {(isFullscreen || editview) && (
          <div className="navbar-buttons navbar-buttons--close">
            <button
              className="btn navbar-button navbar-button--primary"
              onClick={this.onClose}
              title="Back to dashboard"
            >
              <i className="fa fa-reply" />
            </button>
          </div>
        )}
      </div>
    );
  }
}

const mapStateToProps = () => ({});

const mapDispatchToProps = {
  updateLocation,
};

export default connect(mapStateToProps, mapDispatchToProps)(DashNav);
