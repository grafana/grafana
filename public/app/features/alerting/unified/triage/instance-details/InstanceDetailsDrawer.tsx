import { css } from '@emotion/css';
import { orderBy } from 'lodash';
import { Fragment, useMemo } from 'react';
import { useMeasure, useWindowSize } from 'react-use';

import { GrafanaTheme2, Labels } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { TimeRangePicker, useTimeRange } from '@grafana/scenes-react';
import { Alert, Box, Drawer, Icon, LoadingBar, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { MENU_WIDTH } from 'app/core/components/AppChrome/MegaMenu/MegaMenu';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { AlertQuery, GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { stateHistoryApi } from '../../api/stateHistoryApi';
import { getThresholdsForQueries } from '../../components/rule-editor/util';
import { EventState } from '../../components/rules/central-state-history/EventListSceneObject';
import { LogRecord, historyDataFrameToLogRecords } from '../../components/rules/state-history/common';
import { isAlertQueryOfAlertData } from '../../rule-editor/formProcessing';
import { stringifyErrorLike } from '../../utils/misc';
import { useWorkbenchContext } from '../WorkbenchContext';
import { COLUMN_BORDER_WIDTH, COLUMN_CONTENT_PADDING, GRID_GAP_SPACING } from '../rows/GenericRow';

import { InstanceDetailsDrawerTitle } from './InstanceDetailsDrawerTitle';
import { QueryVisualization } from './QueryVisualization';
import { convertStateHistoryToAnnotations } from './stateHistoryUtils';

const { useGetAlertRuleQuery } = alertRuleApi;
const { useGetRuleHistoryQuery } = stateHistoryApi;

function calculateDrawerWidth(
  leftColumnWidth: number,
  megaMenuDocked: boolean,
  megaMenuOpen: boolean,
  screenWidth: number
): string {
  // Calculate the drawer width to align with the right column (chart area)
  // The drawer opens from the right, so we use calc to get: 100% - leftColumnWidth - gap
  // If the mega menu is docked and open, we also subtract its width
  // We also clamp to a max width to prevent the drawer from being too wide on ultra-wide monitors
  const megaMenuOffset = megaMenuDocked && megaMenuOpen ? MENU_WIDTH : '0px';
  const gap = GRID_GAP_SPACING * 8; // theme.spacing(2) = 16px (8px per spacing unit)

  // Account for all the visual space the left column takes:
  // - Both column borders (left and right)
  // - Right padding of the left column content
  // - Left padding of the right column content (to fully clear the separator area)
  const borders = COLUMN_BORDER_WIDTH * 2; // Border on each column
  const leftColumnPadding = COLUMN_CONTENT_PADDING * 2; // Left column has padding on both sides
  const calculatedWidth = `calc(100% - ${leftColumnWidth}px - ${gap + borders + leftColumnPadding}px - ${megaMenuOffset})`;

  // Calculate max width based on screen size:
  // - On smaller screens (< 1920px): no max width, always align with left column separator (with larger buffer)
  // - On larger screens (ultra-wide): cap at 1400px to prevent drawer from being too wide
  if (screenWidth < 1920) {
    return calculatedWidth; // No max width constraint, use calculated width based on separator
  }

  const maxWidth = '1400px';
  return `min(${calculatedWidth}, ${maxWidth})`;
}

interface InstanceDetailsDrawerProps {
  ruleUID: string;
  instanceLabels: Labels;
  onClose: () => void;
}

export function InstanceDetailsDrawer({ ruleUID, instanceLabels, onClose }: InstanceDetailsDrawerProps) {
  const [ref, { width: loadingBarWidth }] = useMeasure<HTMLDivElement>();
  const [timeRange] = useTimeRange();
  const { leftColumnWidth } = useWorkbenchContext();
  const { chrome } = useGrafana();
  const chromeState = chrome.useState();
  const { width: screenWidth } = useWindowSize();

  const drawerWidth = calculateDrawerWidth(
    leftColumnWidth,
    chromeState.megaMenuDocked,
    chromeState.megaMenuOpen,
    screenWidth
  );

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
    labels: instanceLabels,
    from: timeRange.from.unix(),
    to: timeRange.to.unix(),
  });

  // Convert state history to LogRecords and filter by instance labels
  const { historyRecords, annotations } = useMemo(() => {
    const historyRecords = historyDataFrameToLogRecords(stateHistoryData);
    const annotations = convertStateHistoryToAnnotations(historyRecords);

    return { historyRecords, annotations };
  }, [stateHistoryData]);

  if (error) {
    return (
      <Drawer
        title={<InstanceDetailsDrawerTitle instanceLabels={instanceLabels} />}
        onClose={onClose}
        width={drawerWidth}
      >
        <ErrorContent error={error} />
      </Drawer>
    );
  }

  if (loading || !rule) {
    return (
      <Drawer
        title={<InstanceDetailsDrawerTitle instanceLabels={instanceLabels} />}
        onClose={onClose}
        width={drawerWidth}
      >
        <LoadingPlaceholder text={t('alerting.common.loading', 'Loading...')} />
      </Drawer>
    );
  }

  return (
    <Drawer
      title={<InstanceDetailsDrawerTitle instanceLabels={instanceLabels} rule={rule.grafana_alert} />}
      onClose={onClose}
      width={drawerWidth}
    >
      <Stack direction="column" gap={3}>
        <Stack justifyContent="flex-end">
          <TimeRangePicker />
        </Stack>
        {dataQueries.length > 0 && (
          <Box>
            <Stack direction="column" gap={2}>
              {dataQueries.map((query, index) => (
                <QueryVisualization
                  key={query.refId || `query-${index}`}
                  query={query}
                  instanceLabels={instanceLabels}
                  thresholds={thresholds}
                  annotations={annotations}
                />
              ))}
            </Stack>
          </Box>
        )}

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
                <InstanceStateTransitions records={historyRecords} />
              ) : (
                <Text color="secondary">{t('alerting.instance-details.no-history', 'No recent state changes')}</Text>
              )}
            </Stack>
          )}
        </Box>
      </Stack>
    </Drawer>
  );
}

export interface InstanceLocationProps {
  folderTitle: string;
  groupName: string;
  ruleName: string;
}

export function InstanceLocation({ folderTitle, groupName, ruleName }: InstanceLocationProps) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon size="xs" name="folder" />
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Text variant="bodySmall">{folderTitle}</Text>
        <Icon size="sm" name="angle-right" />
        <Text variant="bodySmall">{groupName}</Text>
        <Icon size="sm" name="angle-right" />
        <Text variant="bodySmall">{ruleName}</Text>
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

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatTimestamp(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

function InstanceStateTransitions({ records }: { records: LogRecord[] }) {
  const styles = useStyles2(stateTransitionStyles);
  const sortedRecords = orderBy(records, (r) => r.timestamp, 'desc');

  return (
    <div className={styles.container}>
      {sortedRecords.map((record, index) => (
        <Fragment key={`${record.timestamp}-${index}`}>
          <Text color="secondary" variant="bodySmall">
            {formatTimestamp(record.timestamp)}
          </Text>
          <EventState state={record.line.previous} showLabel addFilter={() => {}} type="from" />
          <Icon name="arrow-right" size="sm" />
          <EventState state={record.line.current} showLabel addFilter={() => {}} type="to" />
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
