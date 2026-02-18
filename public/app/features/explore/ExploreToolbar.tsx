import { css, cx } from '@emotion/css';
import { pick } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { shallowEqual } from 'react-redux';

import { DataSourceInstanceSettings, RawTimeRange, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import {
  ConstantVariable,
  ControlsLabel,
  SceneVariable,
  SceneVariableState,
  SceneVariableValueChangedEvent,
  useSceneObjectState,
} from '@grafana/scenes';
import {
  defaultIntervals,
  PageToolbar,
  RefreshPicker,
  SetInterval,
  ToolbarButton,
  ButtonGroup,
  useStyles2,
} from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { CORRELATION_EDITOR_POST_CONFIRM_ACTION } from 'app/types/explore';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { updateFiscalYearStartMonthForSession, updateTimeZoneForSession } from '../profile/state/reducers';
import { getFiscalYearStartMonth, getTimeZone } from '../profile/state/selectors';

import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { ShortLinkButtonMenu } from './ShortLinkButtonMenu';
import { ExploreVariableEditor } from './Variables/ExploreVariableEditor';
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
  toolbarOverrides: css({
    '& > div:first-child': {
      flexWrap: 'wrap',
      maxWidth: '100%',
    },
    '& > div:first-child > nav > div': {
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    },
  }),
});

interface Props {
  exploreId: string;
  onChangeTime: (range: RawTimeRange, changedByScanner?: boolean) => void;
  onContentOutlineToogle: () => void;
  isContentOutlineOpen: boolean;
}

function ExploreVariableSelector({ variable }: { variable: SceneVariable }) {
  const state = useSceneObjectState<SceneVariableState>(variable, { shouldActivateOrKeepAlive: true });
  const styles = useStyles2(getVariableStyles);
  const labelOrName = state.label || state.name;
  const elementId = `var-${state.key}`;

  return (
    <div className={styles.container}>
      <ControlsLabel htmlFor={elementId} isLoading={state.loading} label={labelOrName} description={state.description ?? undefined} />
      <variable.Component model={variable} />
    </div>
  );
}

const getVariableStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    '> :nth-child(2)': {
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
    },
  }),
});

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
  const variableSet = useSelector((state: StoreState) => state.explore.panes[exploreId]?.variableSet);
  const [variables, setVariables] = useState(() =>
    (variableSet?.state.variables ?? []).filter((v) => !(v instanceof ConstantVariable))
  );

  useEffect(() => {
    setVariables((variableSet?.state.variables ?? []).filter((v) => !(v instanceof ConstantVariable)));
  }, [variableSet]);

  useEffect(() => {
    if (!variableSet) {
      return;
    }
    const deactivate = variableSet.activate();
    const sub = variableSet.subscribeToEvent(SceneVariableValueChangedEvent, () => {
      dispatch(runQueries({ exploreId }));
    });
    return () => {
      sub.unsubscribe();
      deactivate();
    };
  }, [variableSet, dispatch, exploreId]);

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

  const shouldRotateSplitIcon = useMemo(
    () => (isLeftPane && isLargerPane) || (!isLeftPane && !isLargerPane),
    [isLeftPane, isLargerPane]
  );

  const [isVariableEditorOpen, setIsVariableEditorOpen] = useState(false);
  const [variableEditorInitialView, setVariableEditorInitialView] = useState<'list' | 'editor'>('editor');

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

  return (
    <div>
      {refreshInterval && <SetInterval func={onRunQuery} interval={refreshInterval} loading={loading} />}
      <PageToolbar
        className={styles.toolbarOverrides}
        aria-label={t('explore.toolbar.aria-label', 'Explore toolbar')}
        data-testid={selectors.pages.Explore.toolbar.bar}
        leftItems={[
          <ToolbarButton
            key="content-outline"
            variant="canvas"
            tooltip={t('explore.explore-toolbar.tooltip-content-outline', 'Content outline')}
            data-testid={selectors.pages.Explore.toolbar.contentOutline}
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
          variables.length > 0 ? (
            <ToolbarButton
              key="manage-variables"
              icon="cog"
              variant="canvas"
              onClick={() => {
                setVariableEditorInitialView('list');
                setIsVariableEditorOpen(true);
              }}
            >
              <Trans i18nKey="explore.toolbar.manage-variables">Manage variables</Trans>
            </ToolbarButton>
          ) : (
            <ToolbarButton
              key="add-variable"
              icon="plus"
              variant="canvas"
              onClick={() => {
                setVariableEditorInitialView('editor');
                setIsVariableEditorOpen(true);
              }}
            >
              <Trans i18nKey="explore.toolbar.add-variable">Add variable</Trans>
            </ToolbarButton>
          ),
          ...variables.map((variable) => (
            <ExploreVariableSelector key={`var-${variable.state.name}`} variable={variable} />
          )),
        ].filter(Boolean)}
        forceShowLeftItems
      >
        {[
          !splitted ? (
            <ToolbarButton
              variant="canvas"
              key="split"
              data-testid={selectors.pages.Explore.toolbar.split}
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
            data-testid={selectors.pages.Explore.toolbar.refreshPicker}
          />,
          (!splitted || !isLeftPane) && <ShortLinkButtonMenu key="share" hideText={showSmallTimePicker} />,
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
      {isVariableEditorOpen && variableSet && (
        <ExploreVariableEditor
          exploreId={exploreId}
          variableSet={variableSet}
          initialView={variableEditorInitialView}
          onClose={() => {
            setIsVariableEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
