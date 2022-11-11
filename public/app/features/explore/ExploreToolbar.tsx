import React, { lazy, PureComponent, RefObject, Suspense } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { DataSourceInstanceSettings, RawTimeRange } from '@grafana/data';
import { config, DataSourcePicker, reportInteraction } from '@grafana/runtime';
import {
  defaultIntervals,
  PageToolbar,
  RefreshPicker,
  SetInterval,
  ToolbarButton,
  ToolbarButtonRow,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { contextSrv } from 'app/core/core';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { AccessControlAction } from 'app/types';
import { ExploreId } from 'app/types/explore';
import { StoreState } from 'app/types/store';

import { DashNavButton } from '../dashboard/components/DashNav/DashNavButton';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { updateFiscalYearStartMonthForSession, updateTimeZoneForSession } from '../profile/state/reducers';
import { getFiscalYearStartMonth, getTimeZone } from '../profile/state/selectors';

import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { changeDatasource } from './state/datasource';
import { splitClose, splitOpen } from './state/main';
import { cancelQueries, runQueries } from './state/query';
import { isSplit } from './state/selectors';
import { syncTimes, changeRefreshInterval } from './state/time';
import { LiveTailControls } from './useLiveTailControls';

const AddToDashboard = lazy(() =>
  import('./AddToDashboard').then(({ AddToDashboard }) => ({ default: AddToDashboard }))
);

interface OwnProps {
  exploreId: ExploreId;
  onChangeTime: (range: RawTimeRange, changedByScanner?: boolean) => void;
  topOfViewRef: RefObject<HTMLDivElement>;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

class UnConnectedExploreToolbar extends PureComponent<Props> {
  onChangeDatasource = async (dsSettings: DataSourceInstanceSettings) => {
    const { changeDatasource, exploreId } = this.props;
    changeDatasource(exploreId, dsSettings.uid, { importQueries: true });
  };

  onRunQuery = (loading = false) => {
    const { runQueries, cancelQueries, exploreId } = this.props;
    if (loading) {
      return cancelQueries(exploreId);
    } else {
      return runQueries(exploreId);
    }
  };

  onChangeRefreshInterval = (item: string) => {
    const { changeRefreshInterval, exploreId } = this.props;
    changeRefreshInterval(exploreId, item);
  };

  onChangeTimeSync = () => {
    const { syncTimes, exploreId } = this.props;
    syncTimes(exploreId);
  };

  onCopyShortLink = async () => {
    await createAndCopyShortLink(window.location.href);
    reportInteraction('grafana_explore_shortened_link_clicked');
  };

  onOpenSplitView = () => {
    const { split } = this.props;
    split();
    reportInteraction('grafana_explore_split_view_opened', { origin: 'menu' });
  };

  onCloseSplitView = () => {
    const { closeSplit, exploreId } = this.props;
    closeSplit(exploreId);
    reportInteraction('grafana_explore_split_view_closed');
  };

  renderRefreshPicker = (showSmallTimePicker: boolean) => {
    const { loading, refreshInterval, isLive } = this.props;

    let refreshPickerText: string | undefined = loading ? 'Cancel' : 'Run query';
    let refreshPickerTooltip = undefined;
    let refreshPickerWidth = '108px';
    if (showSmallTimePicker) {
      refreshPickerTooltip = refreshPickerText;
      refreshPickerText = undefined;
      refreshPickerWidth = '35px';
    }

    return (
      <RefreshPicker
        key="refreshPicker"
        onIntervalChanged={this.onChangeRefreshInterval}
        value={refreshInterval}
        isLoading={loading}
        text={refreshPickerText}
        tooltip={refreshPickerTooltip}
        intervals={getTimeSrv().getValidIntervals(defaultIntervals)}
        isLive={isLive}
        onRefresh={() => this.onRunQuery(loading)}
        noIntervalPicker={isLive}
        primary={true}
        width={refreshPickerWidth}
      />
    );
  };

  renderActions = () => {
    const {
      splitted,
      isLive,
      exploreId,
      range,
      timeZone,
      fiscalYearStartMonth,
      onChangeTime,
      syncedTimes,
      onChangeTimeZone,
      onChangeFiscalYearStartMonth,
      refreshInterval,
      loading,
      isPaused,
      hasLiveOption,
      containerWidth,
    } = this.props;
    const showSmallTimePicker = splitted || containerWidth < 1210;

    const showExploreToDashboard =
      contextSrv.hasAccess(AccessControlAction.DashboardsCreate, contextSrv.isEditor) ||
      contextSrv.hasAccess(AccessControlAction.DashboardsWrite, contextSrv.isEditor);

    return [
      !splitted ? (
        <ToolbarButton
          key="split"
          tooltip="Split the pane"
          onClick={this.onOpenSplitView}
          icon="columns"
          disabled={isLive}
        >
          Split
        </ToolbarButton>
      ) : (
        <ToolbarButton key="split" tooltip="Close split pane" onClick={this.onCloseSplitView} icon="times">
          Close
        </ToolbarButton>
      ),

      showExploreToDashboard && (
        <Suspense key="addToDashboard" fallback={null}>
          <AddToDashboard exploreId={exploreId} />
        </Suspense>
      ),

      !isLive && (
        <ExploreTimeControls
          key="timeControls"
          exploreId={exploreId}
          range={range}
          timeZone={timeZone}
          fiscalYearStartMonth={fiscalYearStartMonth}
          onChangeTime={onChangeTime}
          splitted={splitted}
          syncedTimes={syncedTimes}
          onChangeTimeSync={this.onChangeTimeSync}
          hideText={showSmallTimePicker}
          onChangeTimeZone={onChangeTimeZone}
          onChangeFiscalYearStartMonth={onChangeFiscalYearStartMonth}
        />
      ),

      this.renderRefreshPicker(showSmallTimePicker),

      refreshInterval && (
        <SetInterval key="setInterval" func={this.onRunQuery} interval={refreshInterval} loading={loading} />
      ),

      hasLiveOption && (
        <LiveTailControls key="liveControls" exploreId={exploreId}>
          {(c) => {
            const controls = {
              ...c,
              start: () => {
                reportInteraction('grafana_explore_logs_live_tailing_clicked', {
                  datasourceType: this.props.datasourceType,
                });
                c.start();
              },
            };
            return (
              <LiveTailButton
                splitted={splitted}
                isLive={isLive}
                isPaused={isPaused}
                start={controls.start}
                pause={controls.pause}
                resume={controls.resume}
                stop={controls.stop}
              />
            );
          }}
        </LiveTailControls>
      ),
    ].filter(Boolean);
  };

  render() {
    const { datasourceMissing, exploreId, splitted, containerWidth, topOfViewRef } = this.props;

    const showSmallDataSourcePicker = (splitted ? containerWidth < 700 : containerWidth < 800) || false;
    const isTopnav = config.featureToggles.topnav;

    const getDashNav = () => (
      <DashNavButton
        key="share"
        tooltip="Copy shortened link"
        icon="share-alt"
        onClick={this.onCopyShortLink}
        aria-label="Copy shortened link"
      />
    );

    const getDataSourcePicker = () =>
      !datasourceMissing && (
        <DataSourcePicker
          key={`${exploreId}-ds-picker`}
          mixed={config.featureToggles.exploreMixedDatasource === true}
          onChange={this.onChangeDatasource}
          current={this.props.datasourceRef}
          hideTextValue={showSmallDataSourcePicker}
          width={showSmallDataSourcePicker ? 8 : undefined}
        />
      );

    const topNavActions = [
      getDashNav(),
      !splitted && getDataSourcePicker(),
      <div style={{ flex: 1 }} key="spacer" />,
      <ToolbarButtonRow key="actions" alignment="right">
        {this.renderActions()}
      </ToolbarButtonRow>,
    ].filter(Boolean);

    const toolbarLeftItems = [exploreId === ExploreId.left && getDashNav(), getDataSourcePicker()].filter(Boolean);

    const toolbarLeftItemsTopNav = [
      exploreId === ExploreId.left && (
        <AppChromeUpdate
          actions={[getDashNav(), !splitted && getDataSourcePicker(), <div style={{ flex: 1 }} key="spacer" />].filter(
            Boolean
          )}
        />
      ),
      getDataSourcePicker(),
    ].filter(Boolean);

    return isTopnav && !splitted ? (
      <div ref={topOfViewRef}>
        <AppChromeUpdate actions={topNavActions} />
      </div>
    ) : (
      <div ref={topOfViewRef}>
        <PageToolbar
          aria-label="Explore toolbar"
          title={exploreId === ExploreId.left && !isTopnav ? 'Explore' : undefined}
          pageIcon={exploreId === ExploreId.left && !isTopnav ? 'compass' : undefined}
          leftItems={isTopnav ? toolbarLeftItemsTopNav : toolbarLeftItems}
        >
          {this.renderActions()}
        </PageToolbar>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState, { exploreId }: OwnProps) => {
  const { syncedTimes } = state.explore;
  const exploreItem = state.explore[exploreId]!;
  const { datasourceInstance, datasourceMissing, range, refreshInterval, loading, isLive, isPaused, containerWidth } =
    exploreItem;

  const hasLiveOption = !!datasourceInstance?.meta?.streaming;

  return {
    datasourceMissing,
    datasourceRef: datasourceInstance?.getRef(),
    datasourceType: datasourceInstance?.type,
    loading,
    range,
    timeZone: getTimeZone(state.user),
    fiscalYearStartMonth: getFiscalYearStartMonth(state.user),
    splitted: isSplit(state),
    refreshInterval,
    hasLiveOption,
    isLive,
    isPaused,
    syncedTimes,
    containerWidth,
  };
};

const mapDispatchToProps = {
  changeDatasource,
  changeRefreshInterval,
  cancelQueries,
  runQueries,
  closeSplit: splitClose,
  split: splitOpen,
  syncTimes,
  onChangeTimeZone: updateTimeZoneForSession,
  onChangeFiscalYearStartMonth: updateFiscalYearStartMonthForSession,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const ExploreToolbar = connector(UnConnectedExploreToolbar);
