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
            <DashNavButton
              tooltip="Mark as favorite"
              classSuffix="star"
              icon={`${isStarred ? 'fa fa-star' : 'fa fa-star-o'}`}
              onClick={this.onStarDashboard}
            />
          )}

          {canShare && (
            <DashNavButton
              tooltip="Share dashboard"
              classSuffix="share"
              icon="fa fa-share-square-o"
              onClick={this.onOpenShare}
            />
          )}

          {canSave && (
            <DashNavButton tooltip="Save dashboard" classSuffix="save" icon="fa fa-save" onClick={this.onSave} />
          )}

          {snapshotUrl && (
            <DashNavButton
              tooltip="Open original dashboard"
              classSuffix="snapshot-origin"
              icon="fa fa-link"
              href={snapshotUrl}
            />
          )}

          {showSettings && (
            <DashNavButton tooltip="Dashboard settings" classSuffix="settings" icon="fa fa-cog"
            onClick={this.onOpenSettings} />
          )}
        </div>

        <div className="navbar-buttons navbar-buttons--tv">
          <DashNavButton
            tooltip="Cycke view mode"
            classSuffix="tv"
            icon="fa fa-desktop"
            onClick={this.onToggleTVMode}
          />
        </div>

        {
          // <gf-time-picker class="gf-timepicker-nav" dashboard="ctrl.dashboard" ng-if="!ctrl.dashboard.timepicker.hidden"></gf-time-picker>
        }

        {(isFullscreen || editview) && (
          <div className="navbar-buttons navbar-buttons--close">
            <DashNavButton
              tooltip="Back to dashboard"
              classSuffix="primary"
              icon="fa fa-reply"
              onClick={this.onClose}
            />
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
