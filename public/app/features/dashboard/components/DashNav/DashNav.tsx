// Libaries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

// Utils & Services
import { AngularComponent, getAngularLoader } from 'app/core/services/AngularLoader';
import { appEvents } from 'app/core/app_events';
import { PlaylistSrv } from 'app/features/playlist/playlist_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

// Components
import { DashNavButton } from './DashNavButton';
import { Tooltip, SelectOptionItem } from '@grafana/ui';

// State
import { updateLocation } from 'app/core/actions';

// Types
import { RefreshPicker } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';
import { TimePicker } from '../TimePicker/TimePicker';
import { DashboardModel } from '../../state';
import { TimeRange } from '@grafana/ui/src/types';

export interface Props {
  dashboard: DashboardModel;
  editview: string;
  isEditing: boolean;
  isFullscreen: boolean;
  $injector: any;
  updateLocation: typeof updateLocation;
  onAddPanel: () => void;
}

export interface State {
  timePickerValue: TimeRange;
  refreshPickerValue: SelectOptionItem;
}

export class DashNav extends PureComponent<Props, State> {
  timePickerEl: HTMLElement;
  timepickerCmp: AngularComponent;
  playlistSrv: PlaylistSrv;
  timeSrv: TimeSrv = getTimeSrv();

  constructor(props: Props) {
    super(props);
    this.playlistSrv = this.props.$injector.get('playlistSrv');
    this.state = {
      timePickerValue: this.timeSrv.timeRange(),
      refreshPickerValue: undefined,
    };
  }

  componentDidMount() {
    const loader = getAngularLoader();

    const template =
      '<gf-time-picker class="gf-timepicker-nav" dashboard="dashboard" ng-if="!dashboard.timepicker.hidden" />';
    const scopeProps = { dashboard: this.props.dashboard };

    this.timepickerCmp = loader.load(this.timePickerEl, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.timepickerCmp) {
      this.timepickerCmp.destroy();
    }
  }

  onRefresh = () => {
    this.timeSrv.refreshDashboard();
  };

  onOpenSearch = () => {
    appEvents.emit('show-dash-search');
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
    const { dashboard, $injector } = this.props;
    const dashboardSrv = $injector.get('dashboardSrv');

    dashboardSrv.starDashboard(dashboard.id, dashboard.meta.isStarred).then(newState => {
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

    appEvents.emit('show-modal', {
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
          <a className="navbar-page-btn" onClick={this.onOpenSearch}>
            {!this.isInFullscreenOrSettings && <i className="gicon gicon-dashboard" />}
            {haveFolder && <span className="navbar-page-btn--folder">{folderTitle} / </span>}
            {dashboard.title}
            <i className="fa fa-caret-down" />
          </a>
        </div>
        <div className="navbar__spacer" />
      </>
    );
  }

  get isInFullscreenOrSettings() {
    return this.props.editview || this.props.isFullscreen;
  }

  renderBackButton() {
    return (
      <div className="navbar-edit">
        <Tooltip content="Go back (Esc)">
          <button className="navbar-edit__back-btn" onClick={this.onClose}>
            <i className="fa fa-arrow-left" />
          </button>
        </Tooltip>
      </div>
    );
  }

  onChangeTimePicker = (timeRange: TimeRange) => {
    const { dashboard } = this.props;
    const panel = dashboard.timepicker;
    const hasDelay = panel.nowDelay && timeRange.raw.to === 'now';

    const newRange = {
      from: timeRange.raw.from,
      to: hasDelay ? 'now-' + panel.nowDelay : timeRange.raw.to,
    };

    this.timeSrv.setTime(newRange);
    this.setState({
      timePickerValue: timeRange,
    });
  };

  onChangeRefreshPicker = (selectOptionItem: SelectOptionItem) => {
    this.setState({
      refreshPickerValue: selectOptionItem,
    });
  };

  render() {
    const { dashboard, onAddPanel } = this.props;
    const { timePickerValue, refreshPickerValue } = this.state;
    const { canStar, canSave, canShare, showSettings, isStarred } = dashboard.meta;
    const { snapshot } = dashboard;
    const snapshotUrl = snapshot && snapshot.originalUrl;
    const TimePickerTooltipContent = (
      <>
        {dashboard.formatDate(timePickerValue.from)}
        <br />
        to
        <br />
        {dashboard.formatDate(timePickerValue.to)}
      </>
    );

    return (
      <div className="navbar">
        {this.isInFullscreenOrSettings && this.renderBackButton()}
        {this.renderDashboardTitleSearchButton()}

        {this.playlistSrv.isPlaying && (
          <div className="navbar-buttons navbar-buttons--playlist">
            <DashNavButton
              tooltip="Go to previous dashboard"
              classSuffix="tight"
              icon="fa fa-step-backward"
              onClick={this.onPlaylistPrev}
            />
            <DashNavButton
              tooltip="Stop playlist"
              classSuffix="tight"
              icon="fa fa-stop"
              onClick={this.onPlaylistStop}
            />
            <DashNavButton
              tooltip="Go to next dashboard"
              classSuffix="tight"
              icon="fa fa-forward"
              onClick={this.onPlaylistNext}
            />
          </div>
        )}

        <div className="navbar-buttons navbar-buttons--actions">
          {canSave && (
            <DashNavButton
              tooltip="Add panel"
              classSuffix="add-panel"
              icon="gicon gicon-add-panel"
              onClick={onAddPanel}
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
            <DashNavButton
              tooltip="Dashboard settings"
              classSuffix="settings"
              icon="fa fa-cog"
              onClick={this.onOpenSettings}
            />
          )}
        </div>

        <div className="navbar-buttons navbar-buttons--tv">
          <DashNavButton
            tooltip="Cycle view mode"
            classSuffix="tv"
            icon="fa fa-desktop"
            onClick={this.onToggleTVMode}
          />
        </div>

        <div className="navbar-buttons">
          <TimePicker
            isTimezoneUtc={false}
            value={this.state.timePickerValue}
            onChange={this.onChangeTimePicker}
            tooltipContent={TimePickerTooltipContent}
            onMoveBackward={() => {
              console.log('onMoveBackward');
            }}
            onMoveForward={() => {
              console.log('onMoveForward');
            }}
            onZoom={() => {
              console.log('onZoom');
            }}
            selectOptions={TimePicker.defaultSelectOptions}
            popoverOptions={TimePicker.defaultPopoverOptions}
          />
          <RefreshPicker
            onIntervalChanged={this.onChangeRefreshPicker}
            onRefresh={this.onRefresh}
            intervals={['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d']}
            initialValue={undefined}
            value={refreshPickerValue}
          />
        </div>

        <div className="gf-timepicker-nav" ref={element => (this.timePickerEl = element)} />
      </div>
    );
  }
}

const mapStateToProps = () => ({});

const mapDispatchToProps = {
  updateLocation,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DashNav);
