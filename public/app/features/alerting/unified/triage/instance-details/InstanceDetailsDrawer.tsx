import { css } from '@emotion/css';
import { orderBy } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2, type Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { TimeRangePicker, useTimeRange } from '@grafana/scenes-react';
import {
  Alert,
  Box,
  Button,
  Drawer,
  Icon,
  LoadingBar,
  LoadingPlaceholder,
  Stack,
  Text,
  TextLink,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { type GrafanaManagedContactPoint } from 'app/plugins/datasource/alertmanager/types';
import { type AlertQuery, GrafanaAlertState, type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { stateHistoryApi } from '../../api/stateHistoryApi';
import { getThresholdsForQueries } from '../../components/rule-editor/util';
import { EventState } from '../../components/rules/central-state-history/EventListSceneObject';
import { type LogRecord, historyDataFrameToLogRecords } from '../../components/rules/state-history/common';
import { useCanViewContactPoints } from '../../hooks/useAbilities';
import { isAlertQueryOfAlertData } from '../../rule-editor/formProcessing';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { labelsToMatchersParam } from '../../utils/matchers';
import { stringifyErrorLike } from '../../utils/misc';
import { groups, rulesNav } from '../../utils/navigation';

import { ContactPointDrawer } from './ContactPointDrawer';
import { DrawerTimeRangeInfoBanner } from './DrawerTimeRangeInfoBanner';
import { EditContactPointDrawer } from './EditContactPointDrawer';
import { DrawerBackButton, InstanceDrilldownDrawer } from './InstanceDetailsDrawerShell';
import { InstanceDetailsDrawerTitle } from './InstanceDetailsDrawerTitle';
import { InstanceSilenceForm } from './InstanceSilenceForm';
import { InstanceStateInfoBanner } from './InstanceStateInfoBanner';
import { InstanceTimelineSection } from './InstanceTimelineSection';
import { QueryVisualization } from './QueryVisualization';
import { isDrawerRangeShorterThanQuery } from './drawerTimeRangeUtils';
import { useInstanceAlertState } from './instanceStateUtils';
import { convertStateHistoryToAnnotations } from './stateHistoryUtils';
import { formatTimelineDate, noop } from './timelineUtils';

const { useGetAlertRuleQuery } = alertRuleApi;
const { useGetRuleHistoryQuery } = stateHistoryApi;

function DrawerBackButton({ onClick }: { onClick: () => void }) {
  const backLabel = t('alerting.triage.instance-details-drawer.back', 'Back');
  return (
    <Stack direction="row" alignItems="center">
      <Button variant="secondary" size="sm" fill="text" icon="arrow-left" onClick={onClick} aria-label={backLabel}>
        {backLabel}
      </Button>
    </Stack>
  );
}

interface InstanceDetailsDrawerProps {
  ruleUID: string;
  instanceLabels: Labels;
  commonLabels?: Labels;
  onClose: () => void;
}

/** Stacked drilldown views inside the instance drawer. `declare-incident` and `notification-history-details` are reserved for future work. */
type DrawerView =
  | { type: 'instance-details' }
  /** `receiverResourceId` is K8s `metadata.name` when known (stable across rename); optional when opened from timeline with display string only. */
  | { type: 'contact-point-list'; receiverName: string; receiverResourceId?: string }
  | { type: 'edit-contact-point'; receiverResourceName: string; displayTitle?: string }
  | { type: 'notification-history-details'; notificationUuid: string; timestampMs?: number }
  | { type: 'silence' }
  | { type: 'declare-incident' };

export function InstanceDetailsDrawer({ ruleUID, instanceLabels, commonLabels, onClose }: InstanceDetailsDrawerProps) {
  const [ref, { width: loadingBarWidth }] = useMeasure<HTMLDivElement>();
  const [timeRange] = useTimeRange();
  const theme = useTheme2();
  const canViewContactPoints = useCanViewContactPoints();
  const [viewStack, setViewStack] = useState<DrawerView[]>([{ type: 'instance-details' }]);
  const closeSilenceTimerRef = useRef<number | undefined>(undefined);
  const closeTopInstanceChildTimerRef = useRef<number | undefined>(undefined);
  const [isClosingSilenceDrawer, setIsClosingSilenceDrawer] = useState(false);
  /** True while the top contact-point / edit drilldown is sliding off (back to the layer below). */
  const [isClosingTopInstanceChildDrawer, setIsClosingTopInstanceChildDrawer] = useState(false);

  const silenceDrawerCloseAnimationMs = Number(theme.transitions.duration.standard ?? 180);
  const activeView = viewStack[viewStack.length - 1];
  const canGoBack = viewStack.length > 1;

  const { data: rule, isLoading: loading, error } = useGetAlertRuleQuery({ uid: ruleUID });

  const { dataQueries, thresholds } = useMemo(() => {
    if (rule) {
      return extractQueryDetails(rule.grafana_alert);
    }
    return { dataQueries: [], thresholds: {} };
  }, [rule]);

  // Fetch state history for this specific instance
  const {
    data: stateHistoryData,
    isFetching: stateHistoryFetching,
    isError: stateHistoryError,
  } = useGetRuleHistoryQuery({
    ruleUid: ruleUID,
    matchers: labelsToMatchersParam(instanceLabels),
    from: timeRange.from.unix(),
    to: timeRange.to.unix(),
  });

  // Convert state history to LogRecords and filter by instance labels
  const { historyRecords, annotations } = useMemo(() => {
    const historyRecords = historyDataFrameToLogRecords(stateHistoryData);
    const annotations = convertStateHistoryToAnnotations(historyRecords);

    return { historyRecords, annotations };
  }, [stateHistoryData]);

  const instanceState = useInstanceAlertState(ruleUID, instanceLabels);

  const showInstanceTimeline =
    config.featureToggles.alertingNotificationHistoryTriage && config.featureToggles.kubernetesAlertingHistorian;

  const showDrawerTimeRangeBanner = useMemo(() => {
    if (!rule?.grafana_alert) {
      return false;
    }
    return isDrawerRangeShorterThanQuery(rule.grafana_alert, timeRange);
  }, [rule, timeRange]);

  const getTopDrawerContentWrapper = useCallback(() => {
    const wrappers = document.querySelectorAll<HTMLElement>('.main-view .rc-drawer-content-wrapper');
    return wrappers.item(wrappers.length - 1) ?? null;
  }, []);

  const resetSilencePanelStyles = useCallback(() => {
    const el = getTopDrawerContentWrapper();
    if (el) {
      el.style.removeProperty('transition');
      el.style.removeProperty('transform');
    }
  }, [getTopDrawerContentWrapper]);

  const handleDrawerClose = () => {
    if (closeSilenceTimerRef.current !== undefined) {
      window.clearTimeout(closeSilenceTimerRef.current);
      closeSilenceTimerRef.current = undefined;
    }
    if (closeTopInstanceChildTimerRef.current !== undefined) {
      window.clearTimeout(closeTopInstanceChildTimerRef.current);
      closeTopInstanceChildTimerRef.current = undefined;
    }
    resetSilencePanelStyles();
    setIsClosingSilenceDrawer(false);
    setIsClosingTopInstanceChildDrawer(false);
    setViewStack([{ type: 'instance-details' }]);
    onClose();
  };

  useEffect(() => {
    return () => {
      if (closeSilenceTimerRef.current !== undefined) {
        window.clearTimeout(closeSilenceTimerRef.current);
      }
      if (closeTopInstanceChildTimerRef.current !== undefined) {
        window.clearTimeout(closeTopInstanceChildTimerRef.current);
      }
      resetSilencePanelStyles();
    };
  }, [resetSilencePanelStyles]);

  const popTopView = () => {
    setViewStack((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.slice(0, -1);
    });
  };

  const animateCloseSilenceDrawer = useCallback(() => {
    if (isClosingSilenceDrawer) {
      return;
    }

    const el = getTopDrawerContentWrapper();
    if (el) {
      el.style.transition = `transform ${silenceDrawerCloseAnimationMs}ms ease-in`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transform = 'translateX(100%)';
        });
      });
    }

    setIsClosingSilenceDrawer(true);
    closeSilenceTimerRef.current = window.setTimeout(() => {
      resetSilencePanelStyles();
      popTopView();
      setIsClosingSilenceDrawer(false);
      closeSilenceTimerRef.current = undefined;
    }, silenceDrawerCloseAnimationMs);
  }, [getTopDrawerContentWrapper, isClosingSilenceDrawer, silenceDrawerCloseAnimationMs, resetSilencePanelStyles]);

  /** Slides the top drilldown off (contact list, or edit on top of list) before popping the stack. */
  const animateCloseTopInstanceChildDrawer = useCallback(() => {
    if (isClosingTopInstanceChildDrawer) {
      return;
    }

    const el = getTopDrawerContentWrapper();
    if (el) {
      el.style.transition = `transform ${silenceDrawerCloseAnimationMs}ms ease-in`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transform = 'translateX(100%)';
        });
      });
    }

    setIsClosingTopInstanceChildDrawer(true);
    closeTopInstanceChildTimerRef.current = window.setTimeout(() => {
      resetSilencePanelStyles();
      popTopView();
      setIsClosingTopInstanceChildDrawer(false);
      closeTopInstanceChildTimerRef.current = undefined;
    }, silenceDrawerCloseAnimationMs);
  }, [
    getTopDrawerContentWrapper,
    isClosingTopInstanceChildDrawer,
    resetSilencePanelStyles,
    silenceDrawerCloseAnimationMs,
  ]);

  const handleBack = () => {
    if (activeView.type === 'silence') {
      animateCloseSilenceDrawer();
      return;
    }
    if (activeView.type === 'edit-contact-point' || activeView.type === 'contact-point-list') {
      animateCloseTopInstanceChildDrawer();
      return;
    }

    popTopView();
  };

  const handleOpenSilence = useCallback(() => {
    setViewStack((current) => [...current, { type: 'silence' }]);
  }, []);

  const handleOpenContactPoint = useCallback((receiverName: string) => {
    setViewStack((current) => [...current, { type: 'contact-point-list', receiverName }]);
  }, []);

  const handleOpenEditContactPoint = useCallback((receiverResourceName: string, displayTitle?: string) => {
    setViewStack((current) => {
      const next = [...current];
      const listIdx = next.findIndex((v) => v.type === 'contact-point-list');
      if (listIdx !== -1 && next[listIdx].type === 'contact-point-list') {
        next[listIdx] = { ...next[listIdx], receiverResourceId: receiverResourceName };
      }
      return [...next, { type: 'edit-contact-point', receiverResourceName, displayTitle }];
    });
  }, []);

  const handleContactPointEditSaved = useCallback((saved?: GrafanaManagedContactPoint) => {
    setViewStack((current) => {
      if (current.length <= 1) {
        return current;
      }
      const next = [...current];
      // Always sync filter/title from the saved contact point when we have the new display name (rename).
      // `id` may be unchanged if the mutation response was not parsed — keep existing resource id in that case.
      if (saved?.name) {
        const cpListIdx = next.findIndex((v) => v.type === 'contact-point-list');
        if (cpListIdx !== -1 && next[cpListIdx].type === 'contact-point-list') {
          next[cpListIdx] = {
            ...next[cpListIdx],
            receiverName: saved.name,
            receiverResourceId: saved.id ?? next[cpListIdx].receiverResourceId,
          };
        }
        const editIdx = next.findIndex((v) => v.type === 'edit-contact-point');
        if (editIdx !== -1 && next[editIdx].type === 'edit-contact-point') {
          next[editIdx] = {
            ...next[editIdx],
            receiverResourceName: saved.id ?? next[editIdx].receiverResourceName,
            displayTitle: saved.name,
          };
        }
      }
      return next.slice(0, -1);
    });
  }, []);

  const sharedTitleProps = useMemo(
    () => ({
      instanceLabels,
      commonLabels,
      alertState: instanceState,
      onOpenSilence: handleOpenSilence,
    }),
    [instanceLabels, commonLabels, instanceState, handleOpenSilence]
  );

  const getDrawerTitle = () => <InstanceDetailsDrawerTitle {...sharedTitleProps} rule={rule?.grafana_alert} />;

  const getInstanceDetailsBody = () => {
    if (error) {
      return <ErrorContent error={error} />;
    }

    if (loading || !rule) {
      return <LoadingPlaceholder text={t('alerting.common.loading', 'Loading...')} />;
    }

    return (
      <Stack direction="column" gap={3}>
        <Stack justifyContent="flex-end">
          <TimeRangePicker />
        </Stack>
        {showDrawerTimeRangeBanner && !instanceState && <DrawerTimeRangeInfoBanner />}
        {(instanceState === GrafanaAlertState.NoData || instanceState === GrafanaAlertState.Error) && (
          <InstanceStateInfoBanner state={instanceState === GrafanaAlertState.NoData ? 'nodata' : 'error'} />
        )}
        {dataQueries.length > 0 && (
          <Box>
            <Stack direction="column" gap={2}>
              {dataQueries.map((query, index) => (
                <QueryVisualization
                  key={query.refId ?? `query-${index}`}
                  query={query}
                  instanceLabels={instanceLabels}
                  thresholds={thresholds}
                  annotations={annotations}
                />
              ))}
            </Stack>
          </Box>
        )}

        {showInstanceTimeline ? (
          <InstanceTimelineSection
            ruleUID={ruleUID}
            instanceLabels={instanceLabels}
            timeRange={timeRange}
            historyRecords={historyRecords}
            stateHistoryFetching={stateHistoryFetching}
            stateHistoryError={stateHistoryError}
            loadingBarRef={ref}
            onOpenContactPoint={canViewContactPoints ? handleOpenContactPoint : undefined}
            contactPointPermissionText={
              canViewContactPoints
                ? undefined
                : t(
                    'alerting.instance-details.contact-point-no-permission-tooltip',
                    'You do not have permission to open contact points from here.'
                  )
            }
          />
        ) : (
          <Box ref={ref}>
            <Text variant="h5">{t('alerting.instance-details.state-history', 'Recent State Changes')}</Text>
            {stateHistoryFetching && <LoadingBar width={loadingBarWidth} />}
            {stateHistoryError && (
              <Alert
                severity="error"
                title={t('alerting.instance-details.history-error', 'Failed to load state history')}
              >
                {t(
                  'alerting.instance-details.history-error-desc',
                  'Unable to fetch state transition history for this instance.'
                )}
              </Alert>
            )}
            {!stateHistoryFetching && !stateHistoryError && (
              <Stack direction="column" gap={1}>
                {historyRecords.length > 0 ? (
                  <InstanceStateTransitions records={historyRecords} maxItems={10} />
                ) : (
                  <Text color="secondary">{t('alerting.instance-details.no-history', 'No recent state changes')}</Text>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    );
  };

  if (error || loading || !rule) {
    return (
      <Drawer title={getDrawerTitle()} onClose={handleDrawerClose} size="md">
        {getInstanceDetailsBody()}
      </Drawer>
    );
  }

  /** One stable `InstanceMainDrawer` + conditional drilldowns avoids remounting the instance layer when opening/closing contact or silence (same DOM stacking as before, single React subtree). */
  const showSilenceLayer = activeView.type === 'silence' || isClosingSilenceDrawer;
  const showContactLayer =
    activeView.type === 'contact-point-list' ||
    activeView.type === 'edit-contact-point' ||
    isClosingTopInstanceChildDrawer;

  const isEditContact = activeView.type === 'edit-contact-point';
  let listView: Extract<DrawerView, { type: 'contact-point-list' }> | undefined;
  if (activeView.type === 'contact-point-list') {
    listView = activeView;
  } else if (viewStack.length >= 2) {
    const below = viewStack[viewStack.length - 2];
    if (below.type === 'contact-point-list') {
      listView = below;
    }
  }

  const receiverNameForList =
    listView?.receiverName ?? (isEditContact ? (activeView.displayTitle ?? activeView.receiverResourceName) : '');
  const receiverResourceIdForList = listView?.receiverResourceId;

  const mainDrawerTitle =
    !showSilenceLayer && !showContactLayer && canGoBack ? (
      <Stack direction="column" gap={1}>
        <DrawerBackButton onClick={handleBack} />
        {getDrawerTitle()}
      </Stack>
    ) : undefined;

  return (
    <>
      {/* Same structure as `InstanceMainDrawer` in the shell; inlined so we do not depend on optional `title` in shell types. */}
      <Drawer
        title={mainDrawerTitle ?? <InstanceDetailsDrawerTitle {...sharedTitleProps} rule={rule.grafana_alert} />}
        onClose={handleDrawerClose}
        size="md"
      >
        {getInstanceDetailsBody()}
      </Drawer>

      {showSilenceLayer && (
        <Drawer
          title={
            <InstanceDetailsDrawerTitle
              {...sharedTitleProps}
              rule={rule.grafana_alert}
              titleText={rule.grafana_alert.title}
              sectionLabel={<Trans i18nKey="alerting.triage.instance-details-drawer.section-silence">Silence</Trans>}
              hideActions
              showAlertState={false}
              titleSection={<DrawerBackButton onClick={handleBack} />}
            />
          }
          onClose={handleDrawerClose}
          size="md"
        >
          <InstanceSilenceForm ruleUid={ruleUID} instanceLabels={instanceLabels} onClose={animateCloseSilenceDrawer} />
        </Drawer>
      )}

      {showContactLayer && (
        <AlertmanagerProvider accessType="instance">
          <InstanceDrilldownDrawer
            sharedTitleProps={sharedTitleProps}
            rule={rule.grafana_alert}
            titleText={t('alerting.triage.instance-details-drawer.contact-point-title', 'Contact point: {{name}}', {
              name: receiverNameForList,
            })}
            onClose={handleDrawerClose}
            onBack={handleBack}
          >
            <ContactPointDrawer
              listSearchQuery={receiverNameForList}
              receiverResourceId={receiverResourceIdForList}
              onEditContactPoint={canViewContactPoints && !isEditContact ? handleOpenEditContactPoint : undefined}
            />
          </InstanceDrilldownDrawer>
          {isEditContact && (
            <InstanceDrilldownDrawer
              sharedTitleProps={sharedTitleProps}
              rule={rule.grafana_alert}
              titleText={t('alerting.triage.instance-details-drawer.edit-contact-point-title', 'Edit {{name}}', {
                name: activeView.displayTitle ?? activeView.receiverResourceName,
              })}
              onClose={handleDrawerClose}
              onBack={handleBack}
            >
              <EditContactPointDrawer
                contactPointName={activeView.receiverResourceName}
                onSaveSuccess={handleContactPointEditSaved}
              />
            </InstanceDrilldownDrawer>
          )}
        </AlertmanagerProvider>
      )}
    </>
  );
}

export interface InstanceLocationProps {
  folderTitle: string;
  groupName: string;
  ruleName: string;
  namespaceUid?: string;
  ruleUid?: string;
}

export function InstanceLocation({ folderTitle, groupName, ruleName, namespaceUid, ruleUid }: InstanceLocationProps) {
  const groupUrl =
    namespaceUid != null ? groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, namespaceUid, groupName) : undefined;
  const ruleViewUrl =
    ruleUid != null
      ? rulesNav.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, { uid: ruleUid, ruleSourceName: 'grafana' })
      : undefined;

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon size="xs" name="folder" />
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Text variant="bodySmall">{folderTitle}</Text>
        <Icon size="sm" name="angle-right" />
        {groupUrl ? (
          <TextLink href={groupUrl} variant="bodySmall" color="primary" inline={false}>
            {groupName}
          </TextLink>
        ) : (
          <Text variant="bodySmall">{groupName}</Text>
        )}
        <Icon size="sm" name="angle-right" />
        {ruleViewUrl ? (
          <TextLink href={ruleViewUrl} variant="bodySmall" color="primary" inline={false}>
            {ruleName}
          </TextLink>
        ) : (
          <Text variant="bodySmall">{ruleName}</Text>
        )}
      </Stack>
    </Stack>
  );
}

function extractQueryDetails(rule: GrafanaRuleDefinition) {
  const dataQueries = rule.data.filter((query: AlertQuery) => isAlertQueryOfAlertData(query));

  const allQueries = rule.data;
  const condition = rule.condition;

  const thresholds = getThresholdsForQueries(allQueries, condition);

  return { dataQueries, thresholds };
}

const MAX_STATE_TRANSITIONS = 10;

function InstanceStateTransitions({
  records,
  maxItems = MAX_STATE_TRANSITIONS,
}: {
  records: LogRecord[];
  maxItems?: number;
}) {
  const styles = useStyles2(stateTransitionStyles);
  const sortedRecords = orderBy(records, (r) => r.timestamp, 'desc').slice(0, maxItems);

  return (
    <div className={styles.container}>
      {sortedRecords.map((record, index) => (
        <Fragment key={`${record.timestamp}-${index}`}>
          <Text color="secondary" variant="bodySmall">
            {formatTimelineDate(record.timestamp)}
          </Text>
          <EventState state={record.line.previous} showLabel addFilter={noop} type="from" />
          <Icon name="arrow-right" size="sm" />
          <EventState state={record.line.current} showLabel addFilter={noop} type="to" />
        </Fragment>
      ))}
    </div>
  );
}

const stateTransitionStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content max-content max-content',
    gap: theme.spacing(1, 2),
    alignItems: 'center',
    padding: theme.spacing(1, 0),
  }),
});

interface ErrorContentProps {
  error: unknown;
}

function ErrorContent({ error }: ErrorContentProps) {
  if (isFetchError(error) && error.status === 404) {
    return (
      <Alert title={t('alerting.triage.rule-not-found.title', 'Rule not found')} severity="error">
        {t('alerting.triage.rule-not-found.description', 'The requested rule could not be found.')}
      </Alert>
    );
  }

  return (
    <Alert title={t('alerting.triage.error-loading-rule', 'Error loading rule')} severity="error">
      {stringifyErrorLike(error)}
    </Alert>
  );
}
