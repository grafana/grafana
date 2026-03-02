import { css, cx } from '@emotion/css';
import { pick } from 'lodash';
import { useMemo, useState } from 'react';
import { shallowEqual } from 'react-redux';

import { RawTimeRange, GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import {
  Drawer,
  defaultIntervals,
  PageToolbar,
  RefreshPicker,
  SetInterval,
  ToolbarButton,
  ButtonGroup,
  useStyles2,
  Button,
  Field,
  Input,
  Modal,
  Stack,
  Text,
} from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { CORRELATION_EDITOR_POST_CONFIRM_ACTION } from 'app/types/explore';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { updateFiscalYearStartMonthForSession, updateTimeZoneForSession } from '../profile/state/reducers';
import { getFiscalYearStartMonth, getTimeZone } from '../profile/state/selectors';

import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { ShortLinkButtonMenu } from './ShortLinkButtonMenu';
import { ToolbarExtensionPoint } from './extensions/ToolbarExtensionPoint';
import { changeCorrelationHelperData } from './state/explorePane';
import {
  splitClose,
  splitOpen,
  maximizePaneAction,
  evenPaneResizeAction,
  changeCorrelationEditorDetails,
  saveExploreViewAction,
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
  savedCard: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.borderRadius(1),
    padding: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  savedCardText: css({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
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
  const [isSaveModalOpen, setSaveModalOpen] = useState(false);
  const [isSavedListOpen, setSavedListOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');

  const getAppOrigin = () => `${window.location.protocol}//${window.location.host}`;

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
  const panes = useSelector(selectPanesEntries);
  const storedSavedQueries = useSelector((state: StoreState) => state.explore.savedQueries);
  const savedQueries = useMemo(() => {
    const hardcodedSavedExploration = {
      title: t('explore.toolbar.saved-list.hardcoded-title', 'dashboards usage investigation'),
      url: 'http://localhost:3000/explore?schemaVersion=1&panes=%7B%2239q%22%3A%7B%22datasource%22%3A%22ec1244db-e050-48b1-9fa4-1249c48bf9b1%22%2C%22queries%22%3A%5B%7B%22scenarioId%22%3A%22random_walk%22%2C%22seriesCount%22%3A1%2C%22refId%22%3A%22A%22%2C%22datasource%22%3A%7B%22type%22%3A%22grafana-testdata-datasource%22%2C%22uid%22%3A%22ec1244db-e050-48b1-9fa4-1249c48bf9b1%22%7D%7D%2C%7B%22scenarioId%22%3A%22logs%22%2C%22refId%22%3A%22B%22%2C%22datasource%22%3A%7B%22type%22%3A%22grafana-testdata-datasource%22%2C%22uid%22%3A%22ec1244db-e050-48b1-9fa4-1249c48bf9b1%22%7D%7D%5D%2C%22range%22%3A%7B%22from%22%3A%22now-1h%22%2C%22to%22%3A%22now%22%7D%2C%22panelsState%22%3A%7B%22logs%22%3A%7B%22sortOrder%22%3A%22Descending%22%7D%7D%2C%22compact%22%3Afalse%7D%7D&orgId=1&chunkNotFound=true',
      timestamp: Date.now(),
    };
    return [...storedSavedQueries, hardcodedSavedExploration];
  }, [storedSavedQueries]);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const isCorrelationsEditorMode = correlationDetails?.editorMode || false;
  const isLeftPane = useSelector(isLeftPaneSelector(exploreId));

  const shouldRotateSplitIcon = useMemo(
    () => (isLeftPane && isLargerPane) || (!isLeftPane && !isLargerPane),
    [isLeftPane, isLargerPane]
  );

  const refreshPickerLabel = loading
    ? t('explore.toolbar.refresh-picker-cancel', 'Cancel')
    : t('explore.toolbar.refresh-picker-run', 'Run query');

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

  const closeSaveModal = () => {
    setSaveModalOpen(false);
    setSaveTitle('');
  };

  const onConfirmSaveView = () => {
    const title = saveTitle.trim();
    if (!title) {
      return;
    }
    const location = locationService.getLocation();
    const origin = getAppOrigin();
    const url = new URL(location.pathname + location.search + location.hash, origin).toString();
    dispatch(saveExploreViewAction({ title, url, timestamp: Date.now() }));
    closeSaveModal();
  };

  const onSelectSaved = (exploration: { url: string }) => {
    const parsed = new URL(exploration.url, getAppOrigin());
    const path = parsed.pathname + parsed.search + parsed.hash;
    locationService.replace(path);
    setSavedListOpen(false);
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
      {isSaveModalOpen && (
        <Modal
          title={t('explore.toolbar.save-view-modal.title', 'Save Explore view')}
          icon="save"
          isOpen={true}
          onDismiss={closeSaveModal}
        >
          <Field
            label={t('explore.toolbar.save-view-modal.label', 'Title')}
            description={t('explore.toolbar.save-view-modal.description', 'Choose a name for this Exploration.')}
            required
            noMargin
          >
            <Input
              value={saveTitle}
              onChange={(event) => setSaveTitle(event.currentTarget.value)}
              placeholder={t('explore.toolbar.save-view-modal.placeholder', 'Enter title')}
              autoFocus
            />
          </Field>
          <Modal.ButtonRow>
            <Button variant="secondary" onClick={closeSaveModal}>
              <Trans i18nKey="explore.toolbar.save-view-modal.cancel">Cancel</Trans>
            </Button>
            <Button onClick={onConfirmSaveView} disabled={!saveTitle.trim()}>
              <Trans i18nKey="explore.toolbar.save-view-modal.save">Save</Trans>
            </Button>
          </Modal.ButtonRow>
        </Modal>
      )}
      {isSavedListOpen && (
        <Drawer
          title={t('explore.toolbar.saved-list.title', 'Saved explorations')}
          size="sm"
          onClose={() => setSavedListOpen(false)}
        >
          {savedQueries.length > 0 ? (
            <Stack direction="column" gap={1}>
              {savedQueries.map((exploration, index) => {
                const savedAt =
                  exploration.timestamp !== undefined
                    ? dateTimeFormat(exploration.timestamp)
                    : t('explore.toolbar.saved-list.unknown-time', 'Unknown time');
                return (
                  <div className={styles.savedCard} key={`${exploration.title}-${index}`}>
                    <div className={styles.savedCardText}>
                      <Text variant="body" weight="medium" truncate>
                        {exploration.title}
                      </Text>
                      <Text variant="bodySmall" color="secondary">
                        {savedAt}
                      </Text>
                    </div>
                    <Button variant="secondary" size="sm" icon="folder-open" onClick={() => onSelectSaved(exploration)}>
                      <Trans i18nKey="explore.toolbar.saved-list.load">Load</Trans>
                    </Button>
                  </div>
                );
              })}
            </Stack>
          ) : (
            <p>
              <Trans i18nKey="explore.toolbar.saved-list.empty">No saved explorations yet.</Trans>
            </p>
          )}
        </Drawer>
      )}
    </div>
  );
}
