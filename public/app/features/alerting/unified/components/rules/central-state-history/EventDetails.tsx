import { css } from '@emotion/css';
import { max, min, uniqBy } from 'lodash';
import { useMemo } from 'react';

import { FieldType, GrafanaTheme2, LoadingState, PanelData, dateTime, makeTimeRange } from '@grafana/data';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { CombinedRule } from 'app/types/unified-alerting';

import { useCombinedRule } from '../../../hooks/useCombinedRule';
import { parse } from '../../../utils/rule-id';
import { isGrafanaRulerRule } from '../../../utils/rules';
import { MetaText } from '../../MetaText';
import { VizWrapper } from '../../rule-editor/VizWrapper';
import { AnnotationValue } from '../../rule-viewer/tabs/Details';
import { LogRecord } from '../state-history/common';

import { EventState } from './EventListSceneObject';

interface EventDetailsProps {
  record: LogRecord;
  logRecords: LogRecord[];
}
export function EventDetails({ record, logRecords }: EventDetailsProps) {
  // get the rule from the ruleUID
  const ruleUID = record.line?.ruleUID ?? '';
  const identifier = useMemo(() => {
    return parse(ruleUID, true);
  }, [ruleUID]);
  const { error, loading, result: rule } = useCombinedRule({ ruleIdentifier: identifier, limitAlerts: 0 }); // we limit the alerts to 0 as we only need the rule

  if (error) {
    return (
      <Text>
        <Trans i18nKey="central-alert-history.details.error">Error loading rule for this event.</Trans>
      </Text>
    );
  }
  if (loading) {
    return (
      <Text>
        <Trans i18nKey="central-alert-history.details.loading">Loading...</Trans>
      </Text>
    );
  }

  if (!rule) {
    return (
      <Text>
        <Trans i18nKey="central-alert-history.details.not-found">Rule not found for this event.</Trans>
      </Text>
    );
  }

  const getTransitionsCountByRuleUID = (ruleUID: string) => {
    return logRecords.filter((record) => record.line.ruleUID === ruleUID).length;
  };

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction={'row'} gap={6}>
        <StateTransition record={record} />
        <ValueInTransition record={record} />
        <NumberTransitions transitions={ruleUID ? getTransitionsCountByRuleUID(ruleUID) : 0} />
      </Stack>
      <Annotations rule={rule} />
      <QueryVizualization rule={rule} ruleUID={ruleUID} logRecords={logRecords} />
    </Stack>
  );
}

interface StateTransitionProps {
  record: LogRecord;
}
function StateTransition({ record }: StateTransitionProps) {
  return (
    <Stack gap={0.5} direction={'column'}>
      <Text variant="body" weight="light" color="secondary">
        <Trans i18nKey="central-alert-history.details.state-transitions">State transition</Trans>
      </Text>
      <Stack gap={0.5} direction={'row'} alignItems="center">
        <EventState state={record.line.previous} showLabel />
        <Icon name="arrow-right" size="lg" />
        <EventState state={record.line.current} showLabel />
      </Stack>
    </Stack>
  );
}

interface AnnotationsProps {
  rule: CombinedRule;
}
const Annotations = ({ rule }: AnnotationsProps) => {
  const styles = useStyles2(getStyles);
  const annotations = rule.annotations;
  if (!annotations) {
    return null;
  }
  return (
    <>
      <Text variant="body" color="secondary" weight="light">
        <Trans i18nKey="central-alert-history.details.annotations">Annotations</Trans>
      </Text>
      {Object.keys(annotations).length === 0 ? (
        <Text variant="body" weight="light" italic>
          <Trans i18nKey="central-alert-history.details.no-annotations">No annotations</Trans>
        </Text>
      ) : (
        <div className={styles.metadataWrapper}>
          {Object.entries(annotations).map(([name, value]) => (
            <MetaText direction="column" key={name}>
              {name}
              <AnnotationValue value={value} />
            </MetaText>
          ))}
        </div>
      )}
    </>
  );
};

/**
 *
 * This component renders the visualization for the rule condition values over the selected time range.
 * The visualization is a time series graph with the condition values on the y-axis and time on the x-axis.
 * The values are extracted from the log records already fetched from the history api.
 * The graph is rendered only if the rule is a Grafana rule.
 *
 */
interface QueryVizualizationProps {
  ruleUID: string;
  rule: CombinedRule;
  logRecords: LogRecord[];
}
const QueryVizualization = ({ ruleUID, rule, logRecords }: QueryVizualizationProps) => {
  if (!isGrafanaRulerRule(rule?.rulerRule)) {
    return (
      <Text>
        <Trans i18nKey="central-alert-history.details.not-grafana-rule">Rule is not a Grafana rule</Trans>
      </Text>
    );
  }
  // get the condition from the rule
  const condition = rule?.rulerRule.grafana_alert?.condition ?? 'A';
  // get the panel data for the rule
  const panelData = getPanelDataForRule(ruleUID, logRecords, condition);
  // render the visualization
  return <VizWrapper data={panelData} thresholds={undefined} thresholdsType={undefined} />;
};

/**
 * This function returns the time series panel data for the condtion values of the rule, within the selected time range.
 * The values are extracted from the log records already fetched from the history api.
 * @param ruleUID
 * @param logRecords
 * @param condition
 * @returns PanelData
 */
export function getPanelDataForRule(ruleUID: string, logRecords: LogRecord[], condition: string) {
  const ruleLogRecords = logRecords
    .filter((record) => record.line.ruleUID === ruleUID)
    // sort by timestamp as time series data is expected to be sorted by time
    .sort((a, b) => a.timestamp - b.timestamp);

  // get unique records by timestamp, as timeseries data should have unique timestamps, and it might be possible to have multiple records with the same timestamp
  const uniqueRecords = uniqBy(ruleLogRecords, (record) => record.timestamp);

  const timestamps = uniqueRecords.map((record) => record.timestamp);
  const values = uniqueRecords.map((record) => (record.line.values ? record.line.values[condition] : 0));
  const minTimestamp = min(timestamps);
  const maxTimestamp = max(timestamps);

  const PanelDataObj: PanelData = {
    series: [
      {
        name: 'Rule condition history',
        fields: [
          { name: 'Time', values: timestamps, config: {}, type: FieldType.time },
          { name: 'values', values: values, type: FieldType.number, config: {} },
        ],
        length: timestamps.length,
      },
    ],
    state: LoadingState.Done,
    timeRange: makeTimeRange(dateTime(minTimestamp), dateTime(maxTimestamp)),
  };
  return PanelDataObj;
}

interface ValueInTransitionProps {
  record: LogRecord;
}
function ValueInTransition({ record }: ValueInTransitionProps) {
  const values = record.line.values
    ? JSON.stringify(record.line.values)
    : t('central-alert-history.details.no-values', 'No values');
  return (
    <Stack gap={0.5} direction={'column'}>
      <Text variant="body" weight="light" color="secondary">
        <Trans i18nKey="central-alert-history.details.value-in-transition">Value in transition</Trans>
      </Text>
      <Stack gap={0.5} direction={'row'} alignItems="center">
        <Text variant="body" weight="light">
          {values}
        </Text>
      </Stack>
    </Stack>
  );
}
interface NumberTransitionsProps {
  transitions: number;
}
function NumberTransitions({ transitions }: NumberTransitionsProps) {
  return (
    <Stack gap={0.5} direction={'column'} alignItems="flex-start" justifyContent={'center'}>
      <Text variant="body" weight="light" color="secondary">
        <Trans i18nKey="central-alert-history.details.number-transitions">State transitions for selected period</Trans>
      </Text>
      <Text variant="body" weight="light">
        {transitions}
      </Text>
    </Stack>
  );
}
const getStyles = (theme: GrafanaTheme2) => {
  return {
    metadataWrapper: css({
      display: 'grid',
      gridTemplateColumns: 'auto auto',
      rowGap: theme.spacing(3),
      columnGap: theme.spacing(12),
    }),
  };
};
