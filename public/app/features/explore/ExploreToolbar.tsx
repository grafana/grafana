import { css, cx } from '@emotion/css';
import { pick } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { shallowEqual } from 'react-redux';

import { DataSourceInstanceSettings, RawTimeRange, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ConstantVariable, CustomVariable, SceneVariable, SceneVariableValueChangedEvent } from '@grafana/scenes';
import {
  defaultIntervals,
  IconButton,
  PageToolbar,
  RefreshPicker,
  Select,
  SetInterval,
  Stack,
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
});

interface Props {
  exploreId: string;
  onChangeTime: (range: RawTimeRange, changedByScanner?: boolean) => void;
  onContentOutlineToogle: () => void;
  isContentOutlineOpen: boolean;
}

function ExploreVariableSelectCustom({
  variable,
  onEdit,
}: {
  variable: CustomVariable;
  onEdit: (variable: SceneVariable) => void;
}) {
  const { value, options, name } = variable.useState();
  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Select
        prefix={`$${name}`}
        value={String(value)}
        options={options.map((o) => ({ label: String(o.label) || '(empty)', value: String(o.value) }))}
        onChange={(selected) => {
          if (selected.value !== undefined) {
            variable.setState({ value: selected.value, text: selected.label ?? String(selected.value) });
          }
        }}
        width="auto"
      />
      <IconButton
        name="cog"
        tooltip={t('explore.toolbar.edit-variable', 'Edit variable')}
        onClick={() => onEdit(variable)}
        size="md"
      />
    </Stack>
  );
}

function ExploreVariableSelectGeneric({
  variable,
  onEdit,
}: {
  variable: SceneVariable;
  onEdit: (variable: SceneVariable) => void;
}) {
  const { name } = variable.useState();
  const currentValue = String(variable.getValue());
  const currentText = variable.getValueText?.() ?? currentValue;
  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Select
        prefix={`$${name}`}
        value={currentValue}
        options={[{ label: currentText || '(empty)', value: currentValue }]}
        onChange={() => {}}
        width="auto"
      />
      <IconButton
        name="cog"
        tooltip={t('explore.toolbar.edit-variable', 'Edit variable')}
        onClick={() => onEdit(variable)}
        size="md"
      />
    </Stack>
  );
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
    const sub = variableSet.subscribeToEvent(SceneVariableValueChangedEvent, () => {
      dispatch(runQueries({ exploreId }));
    });
    return () => sub.unsubscribe();
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
  const [editingVariable, setEditingVariable] = useState<SceneVariable | null>(null);

  const onEditVariable = (variable: SceneVariable) => {
    setEditingVariable(variable);
    setIsVariableEditorOpen(true);
  };

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
          <ToolbarButton
            key="add-variable"
            icon="plus"
            variant="canvas"
            onClick={() => setIsVariableEditorOpen(true)}
          >
            <Trans i18nKey="explore.toolbar.add-variable">Add variable</Trans>
          </ToolbarButton>,
          ...variables.map((variable) =>
            variable instanceof CustomVariable ? (
              <ExploreVariableSelectCustom
                key={`var-${variable.state.name}`}
                variable={variable}
                onEdit={onEditVariable}
              />
            ) : (
              <ExploreVariableSelectGeneric
                key={`var-${variable.state.name}`}
                variable={variable}
                onEdit={onEditVariable}
              />
            )
          ),
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
          initialVariable={editingVariable}
          onClose={() => {
            setIsVariableEditorOpen(false);
            setEditingVariable(null);
          }}
        />
      )}
    </div>
  );
}
