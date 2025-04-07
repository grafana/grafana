import { css, cx } from '@emotion/css';
import { pick } from 'lodash';
import { useMemo } from 'react';
import { shallowEqual } from 'react-redux';

import { DataSourceInstanceSettings, RawTimeRange, GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import {
  defaultIntervals,
  PageToolbar,
  RefreshPicker,
  SetInterval,
  ToolbarButton,
  ButtonGroup,
  useStyles2,
  Button,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { t, Trans } from 'app/core/internationalization';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { CORRELATION_EDITOR_POST_CONFIRM_ACTION } from 'app/types/explore';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { contextSrv } from '../../core/core';
import { updateFiscalYearStartMonthForSession, updateTimeZoneForSession } from '../profile/state/reducers';
import { getFiscalYearStartMonth, getTimeZone } from '../profile/state/selectors';

import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { useQueriesDrawerContext } from './QueriesDrawer/QueriesDrawerContext';
import { ShortLinkButtonMenu } from './ShortLinkButtonMenu';
import { ToolbarExtensionPoint } from './extensions/ToolbarExtensionPoint';
import { changeDatasource } from './state/datasource';
import { changeCorrelationHelperData } from './state/explorePane';
import {
  splitClose,
  splitOpen,
  maximizePaneAction,
  evenPaneResizeAction,
  changeCorrelationEditorDetails,
} from './state/main';
import { cancelQueries, runQueries, selectIsWaitingForData } from './state/query';
import { isLeftPaneSelector, isSplit, selectCorrelationDetails, selectPanesEntries } from './state/selectors';
import { syncTimes, changeRefreshInterval } from './state/time';
import { LiveTailControls } from './useLiveTailControls';

const getStyles = (theme: GrafanaTheme2, splitted: Boolean) => ({
  rotateIcon: css({
    '> div > svg': {
      transform: 'rotate(180deg)',
    },
  }),
  toolbarButton: css({
    display: 'flex',
    justifyContent: 'center',
    marginRight: theme.spacing(0.5),
    width: splitted && theme.spacing(6),
  }),
});

interface Props {
  exploreId: string;
  onChangeTime: (range: RawTimeRange, changedByScanner?: boolean) => void;
  onContentOutlineToogle: () => void;
  isContentOutlineOpen: boolean;
}

export function ExploreToolbar({ exploreId, onChangeTime, onContentOutlineToogle, isContentOutlineOpen }: Props) {
  const dispatch = useDispatch();
  const splitted = useSelector(isSplit);
  const styles = useStyles2(getStyles, splitted);

  const timeZone = useSelector((state: StoreState) => getTimeZone(state.user));
  const fiscalYearStartMonth = useSelector((state: StoreState) => getFiscalYearStartMonth(state.user));
  const { refreshInterval, datasourceInstance, range, isLive, isPaused, syncedTimes } = useSelector(
    (state: StoreState) => ({
      ...pick(state.explore.panes[exploreId]!, 'refreshInterval', 'datasourceInstance', 'range', 'isLive', 'isPaused'),
      syncedTimes: state.explore.syncedTimes,
    }),
    shallowEqual
  );
  const loading = useSelector(selectIsWaitingForData(exploreId));
  const isLargerPane = useSelector((state: StoreState) => state.explore.largerExploreId === exploreId);
  const showSmallTimePicker = useSelector((state) => splitted || state.explore.panes[exploreId]!.containerWidth < 1210);
  const showSmallDataSourcePicker = useSelector(
    (state) => state.explore.panes[exploreId]!.containerWidth < (splitted ? 700 : 800)
  );

  const panes = useSelector(selectPanesEntries);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const isCorrelationsEditorMode = correlationDetails?.editorMode || false;
  const isLeftPane = useSelector(isLeftPaneSelector(exploreId));
  const { drawerOpened, setDrawerOpened } = useQueriesDrawerContext();

  const shouldRotateSplitIcon = useMemo(
    () => (isLeftPane && isLargerPane) || (!isLeftPane && !isLargerPane),
    [isLeftPane, isLargerPane]
  );

  const refreshPickerLabel = loading
    ? t('explore.toolbar.refresh-picker-cancel', 'Cancel')
    : t('explore.toolbar.refresh-picker-run', 'Run query');

  const onChangeDatasource = async (dsSettings: DataSourceInstanceSettings) => {
    if (!isCorrelationsEditorMode) {
      dispatch(changeDatasource({ exploreId, datasource: dsSettings.uid, options: { importQueries: true } }));
    } else {
      if (correlationDetails?.correlationDirty || correlationDetails?.queryEditorDirty) {
        // prompt will handle datasource change if needed
        dispatch(
          changeCorrelationEditorDetails({
            isExiting: true,
            postConfirmAction: {
              exploreId: exploreId,
              action: CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE,
              changeDatasourceUid: dsSettings.uid,
              isActionLeft: isLeftPane,
            },
          })
        );
      } else {
        // if the left pane is changing, clear helper data for right pane
        if (isLeftPane) {
          panes.forEach((pane) => {
            dispatch(
              changeCorrelationHelperData({
                exploreId: pane[0],
                correlationEditorHelperData: undefined,
              })
            );
          });
        }

        dispatch(changeDatasource({ exploreId, datasource: dsSettings.uid, options: { importQueries: true } }));
      }
    }
  };

  const onRunQuery = (loading = false) => {
    if (loading) {
      return dispatch(cancelQueries(exploreId));
    } else {
      return dispatch(runQueries({ exploreId }));
    }
  };

  const onChangeTimeZone = (timezone: string) => dispatch(updateTimeZoneForSession(timezone));

  const onOpenSplitView = () => {
    dispatch(splitOpen());
    reportInteraction('grafana_explore_split_view_opened', { origin: 'menu' });
  };

  const onCloseSplitView = () => {
    if (isCorrelationsEditorMode) {
      if (correlationDetails?.correlationDirty || correlationDetails?.queryEditorDirty) {
        // if dirty, prompt
        dispatch(
          changeCorrelationEditorDetails({
            isExiting: true,
            postConfirmAction: {
              exploreId: exploreId,
              action: CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE,
              isActionLeft: isLeftPane,
            },
          })
        );
      } else {
        // otherwise, clear helper data and close
        panes.forEach((pane) => {
          dispatch(
            changeCorrelationHelperData({
              exploreId: pane[0],
              correlationEditorHelperData: undefined,
            })
          );
        });
        dispatch(splitClose(exploreId));
        reportInteraction('grafana_explore_split_view_closed');
      }
    } else {
      dispatch(splitClose(exploreId));
      reportInteraction('grafana_explore_split_view_closed');
    }
  };

  const onClickResize = () => {
    if (isLargerPane) {
      dispatch(evenPaneResizeAction());
    } else {
      dispatch(maximizePaneAction({ exploreId }));
    }
  };

  const onChangeTimeSync = () => {
    dispatch(syncTimes(exploreId));
  };

  const onChangeFiscalYearStartMonth = (fiscalyearStartMonth: number) =>
    dispatch(updateFiscalYearStartMonthForSession(fiscalyearStartMonth));

  const onChangeRefreshInterval = (refreshInterval: string) => {
    dispatch(changeRefreshInterval({ exploreId, refreshInterval }));
  };

  const navBarActions = [
    <Button
      key="query-history"
      size="sm"
      variant={'secondary'}
      aria-label={t('explore.secondary-actions.query-history-button-aria-label', 'Query history')}
      onClick={() => setDrawerOpened(!drawerOpened)}
      data-testid={Components.QueryTab.queryHistoryButton}
      icon="history"
    >
      <Trans i18nKey="explore.secondary-actions.query-history-button">Query history</Trans>
    </Button>,
    <ShortLinkButtonMenu key="share" />,
  ];

  return (
    <div>
      {refreshInterval && <SetInterval func={onRunQuery} interval={refreshInterval} loading={loading} />}
      <AppChromeUpdate actions={navBarActions} />
      <PageToolbar
        aria-label={t('explore.toolbar.aria-label', 'Explore toolbar')}
        leftItems={[
          <ToolbarButton
            key="content-outline"
            variant="canvas"
            tooltip={t('explore.explore-toolbar.tooltip-content-outline', 'Content outline')}
            icon="list-ui-alt"
            iconOnly={splitted}
            onClick={onContentOutlineToogle}
            aria-expanded={isContentOutlineOpen}
            aria-controls={isContentOutlineOpen ? 'content-outline-container' : undefined}
            className={styles.toolbarButton}
          >
            <Trans i18nKey="explore.explore-toolbar.outline">Outline</Trans>
          </ToolbarButton>,
          <DataSourcePicker
            key={`${exploreId}-ds-picker`}
            mixed={!isCorrelationsEditorMode}
            onChange={onChangeDatasource}
            current={datasourceInstance?.getRef()}
            hideTextValue={showSmallDataSourcePicker}
            width={showSmallDataSourcePicker ? 8 : undefined}
          />,
          <ToolbarExtensionPoint
            key="toolbar-extension-point"
            exploreId={exploreId}
            timeZone={timeZone}
            extensionsToShow="queryless"
          />,
        ].filter(Boolean)}
        forceShowLeftItems
      >
        {[
          !splitted ? (
            <ToolbarButton
              variant="canvas"
              key="split"
              tooltip={t('explore.toolbar.split-tooltip', 'Split the pane')}
              onClick={onOpenSplitView}
              icon="columns"
              disabled={isLive}
            >
              <Trans i18nKey="explore.toolbar.split-title">Split</Trans>
            </ToolbarButton>
          ) : (
            <ButtonGroup key="split-controls">
              <ToolbarButton
                variant="canvas"
                tooltip={
                  isLargerPane
                    ? t('explore.toolbar.split-narrow', 'Narrow pane')
                    : t('explore.toolbar.split-widen', 'Widen pane')
                }
                onClick={onClickResize}
                icon={isLargerPane ? 'gf-movepane-left' : 'gf-movepane-right'}
                iconOnly={true}
                className={cx(shouldRotateSplitIcon && styles.rotateIcon)}
              />
              <ToolbarButton
                tooltip={t('explore.toolbar.split-close-tooltip', 'Close split pane')}
                onClick={onCloseSplitView}
                icon="times"
                variant="canvas"
              >
                <Trans i18nKey="explore.toolbar.split-close"> Close </Trans>
              </ToolbarButton>
            </ButtonGroup>
          ),
          <ToolbarExtensionPoint
            key="toolbar-extension-point"
            exploreId={exploreId}
            timeZone={timeZone}
            extensionsToShow="basic"
          />,
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
              onChangeTimeSync={onChangeTimeSync}
              hideText={showSmallTimePicker}
              onChangeTimeZone={onChangeTimeZone}
              onChangeFiscalYearStartMonth={onChangeFiscalYearStartMonth}
            />
          ),
          <RefreshPicker
            key="refreshPicker"
            onIntervalChanged={onChangeRefreshInterval}
            value={refreshInterval}
            isLoading={loading}
            text={showSmallTimePicker ? undefined : refreshPickerLabel}
            tooltip={showSmallTimePicker ? refreshPickerLabel : undefined}
            intervals={contextSrv.getValidIntervals(defaultIntervals)}
            isLive={isLive}
            onRefresh={() => onRunQuery(loading)}
            noIntervalPicker={isLive}
            primary={true}
            width={(showSmallTimePicker ? 35 : 108) + 'px'}
          />,
          datasourceInstance?.meta.streaming && (
            <LiveTailControls key="liveControls" exploreId={exploreId}>
              {(c) => {
                const controls = {
                  ...c,
                  start: () => {
                    reportInteraction('grafana_explore_logs_live_tailing_clicked', {
                      datasourceType: datasourceInstance?.type,
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
        ].filter(Boolean)}
      </PageToolbar>
    </div>
  );
}
