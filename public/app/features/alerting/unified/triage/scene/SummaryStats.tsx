import { css } from '@emotion/css';

import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { useQueryRunner } from '@grafana/scenes-react';
import { Box, ErrorBoundaryAlert, Icon, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { FIELD_NAMES } from '../constants';

import { normalizeFrame } from './dataTransform';
import { summaryRuleCountQuery } from './queries';
import { cleanAlertStateFilter, useQueryFilter } from './utils';

type AlertState = PromAlertingRuleState.Firing | PromAlertingRuleState.Pending;

export function countRules(ruleFrame: DataFrame) {
  const ruleUIDField = ruleFrame.fields.find((f) => f.name === FIELD_NAMES.grafanaRuleUID);
  const alertstateField = ruleFrame.fields.find((f) => f.name === FIELD_NAMES.alertstate);

  if (!ruleUIDField || !alertstateField) {
    return { firing: 0, pending: 0 };
  }

  const counts = {
    [PromAlertingRuleState.Firing]: new Set<string>(),
    [PromAlertingRuleState.Pending]: new Set<string>(),
  };

  ruleUIDField.values.forEach((ruleUID: string, i: number) => {
    const alertstate: AlertState = alertstateField.values[i];
    counts[alertstate]?.add(ruleUID);
  });

  return {
    firing: counts[PromAlertingRuleState.Firing].size,
    pending: counts[PromAlertingRuleState.Pending].size,
  };
}

export function countInstances(instanceFrame: DataFrame) {
  const frame = normalizeFrame(instanceFrame);
  const alertstateField = frame.fields.find((f) => f.name === FIELD_NAMES.alertstate);
  const valueField = frame.fields.find((f) => f.name === FIELD_NAMES.value);

  if (!alertstateField || !valueField) {
    return { firing: 0, pending: 0 };
  }

  const getValue = (state: AlertState) => {
    const index = alertstateField.values.findIndex((s: string) => s === state);
    return valueField.values[index] ?? 0;
  };
  return { firing: getValue(PromAlertingRuleState.Firing), pending: getValue(PromAlertingRuleState.Pending) };
}

interface CompactStatRowProps {
  color: 'error' | 'warning';
  icon: 'exclamation-circle' | 'circle';
  ruleCount: number;
  stateLabel: AlertState;
}

function CompactStatRow({ color, icon, ruleCount, stateLabel }: CompactStatRowProps) {
  const styles = useStyles2(getCompactStatStyles);
  const iconColor = color === 'error' ? styles.errorColor : styles.warningColor;

  return (
    <div className={styles.statRow}>
      <Icon name={icon} size="sm" className={iconColor} />
      <Text element="span" weight="medium" color={color}>
        {stateLabel === 'firing' ? (
          <Trans i18nKey="alerting.triage.compact-firing">firing</Trans>
        ) : (
          <Trans i18nKey="alerting.triage.compact-pending">pending</Trans>
        )}
      </Text>
      <span className={`${styles.statValue} ${iconColor}`}>{ruleCount}</span>
      <Text element="span" color="secondary" variant="bodySmall">
        <Trans i18nKey="alerting.triage.compact-rules">rules</Trans>
      </Text>
    </div>
  );
}

function SummaryStatsContent() {
  const styles = useStyles2(getCompactStatStyles);
  const filter = useQueryFilter();

  // Strip alertstate from filter since the dedup queries add their own alertstate matchers.
  const cleanFilter = cleanAlertStateFilter(filter);

  const ruleDataProvider = useQueryRunner({
    queries: [summaryRuleCountQuery(cleanFilter)],
  });

  const { data: ruleData } = ruleDataProvider.useState();
  const ruleFrame = ruleData?.series?.at(0);

  if (!ruleDataProvider.isDataReadyToDisplay() || !ruleFrame) {
    return <div />;
  }

  if (ruleFrame.length === 0) {
    return <div />;
  }

  const rules = countRules(ruleFrame);

  return (
    <Box backgroundColor="secondary" borderRadius="default" padding={1.5}>
      <div className={styles.statsGrid}>
        {rules.firing > 0 && (
          <CompactStatRow
            color="error"
            icon="exclamation-circle"
            ruleCount={rules.firing}
            stateLabel={PromAlertingRuleState.Firing}
          />
        )}
        {rules.pending > 0 && (
          <CompactStatRow
            color="warning"
            icon="circle"
            ruleCount={rules.pending}
            stateLabel={PromAlertingRuleState.Pending}
          />
        )}
      </div>
    </Box>
  );
}

export function SummaryStatsReact() {
  return (
    <ErrorBoundaryAlert>
      <SummaryStatsContent />
    </ErrorBoundaryAlert>
  );
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryStatsScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryStatsReact;
}

const getCompactStatStyles = (theme: GrafanaTheme2) => ({
  statsGrid: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content max-content max-content',
    alignItems: 'center',
    columnGap: theme.spacing(1.5),
    rowGap: theme.spacing(0.5),
    fontSize: theme.typography.body.fontSize,
  }),
  statRow: css({
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: 'subgrid',
    alignItems: 'center',
  }),
  statValue: css({
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.h4.fontSize,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  }),
  errorColor: css({
    color: theme.colors.error.text,
  }),
  warningColor: css({
    color: theme.colors.warning.text,
  }),
});
