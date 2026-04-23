import { css, cx } from '@emotion/css';
import { forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { type Rule, type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { RuleActionsButtons } from '../../components/RuleActionsButtons.V2';
import { normalizeState } from '../../components/util';

interface Props {
  rule: Rule;
  index?: number;
  contactPoint?: string;
  instanceCount?: number;
  showStateChip?: boolean;
  groupIdentifier?: RuleGroupIdentifierV2;
}

export const RuleCard = forwardRef<HTMLDivElement, Props>(function RuleCard(
  { rule, index, contactPoint, instanceCount, showStateChip = true, groupIdentifier },
  ref
) {
  const styles = useStyles2(getStyles);
  const isRecording = rule.type === PromRuleType.Recording;

  return (
    <div ref={ref} className={cx(styles.card, isRecording ? styles.recording : styles.alert)}>
      {typeof index === 'number' && <span className={styles.index}>{index + 1}.</span>}
      <Icon name={isRecording ? 'record-audio' : 'bell'} className={styles.typeIcon} />
      <div className={styles.body}>
        <Text variant="body" weight="medium" color={isRecording ? 'info' : 'primary'}>
          <code className={styles.name}>{rule.name}</code>
        </Text>
        {typeof instanceCount === 'number' && (
          <span className={styles.meta}>
            <Trans i18nKey="alerting.rule-list-v2.instance-count" values={{ count: instanceCount }}>
              {'{{count}} inst.'}
            </Trans>
            <MetaContactPoint contactPoint={contactPoint} isRecording={isRecording} />
          </span>
        )}
      </div>
      <Stack direction="row" alignItems="center" gap={1}>
        {showStateChip && !isRecording && 'state' in rule && <MiniStateBadge state={normalizeState(rule.state)} />}
        {contactPoint && typeof instanceCount !== 'number' && (
          <Text variant="bodySmall" color="secondary">
            → {contactPoint}
          </Text>
        )}
        {!contactPoint && !isRecording && typeof instanceCount !== 'number' && (
          <Text variant="bodySmall" color="warning">
            <Trans i18nKey="alerting.rule-list-v2.no-contact">no contact</Trans>
          </Text>
        )}
        {groupIdentifier && <RuleActionsButtons compact promRule={rule} groupIdentifier={groupIdentifier} />}
      </Stack>
    </div>
  );
});

function MetaContactPoint({ contactPoint, isRecording }: { contactPoint?: string; isRecording: boolean }) {
  if (contactPoint) {
    return (
      <>
        {' · '}→ {contactPoint}
      </>
    );
  }
  if (!isRecording) {
    return (
      <>
        {' · '}
        <Text color="warning">
          <Trans i18nKey="alerting.rule-list-v2.no-contact-warning">⚠ no contact</Trans>
        </Text>
      </>
    );
  }
  return null;
}

function MiniStateBadge({ state }: { state: ReturnType<typeof normalizeState> }) {
  const styles = useStyles2(getStyles);
  if (!state || state === 'unknown') {
    return null;
  }
  return <span className={cx(styles.stateBadge, styles[`state_${state}`])}>{label(state)}</span>;
}

function label(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderLeft: `2px solid transparent`,
    }),
    alert: css({
      borderLeftColor: theme.colors.warning.main,
    }),
    recording: css({
      borderLeftColor: theme.colors.info.main,
    }),
    index: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      minWidth: theme.spacing(2),
    }),
    typeIcon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
    body: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minWidth: 0,
    }),
    name: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.body.fontSize,
      background: 'none',
      padding: 0,
    }),
    meta: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    stateBadge: css({
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.pill,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    state_firing: css({
      background: theme.colors.error.transparent,
      color: theme.colors.error.text,
      border: `1px solid ${theme.colors.error.border}`,
    }),
    state_pending: css({
      background: theme.colors.warning.transparent,
      color: theme.colors.warning.text,
      border: `1px solid ${theme.colors.warning.border}`,
    }),
    state_recovering: css({
      background: theme.colors.info.transparent,
      color: theme.colors.info.text,
      border: `1px solid ${theme.colors.info.border}`,
    }),
    state_normal: css({
      background: theme.colors.success.transparent,
      color: theme.colors.success.text,
      border: `1px solid ${theme.colors.success.border}`,
    }),
    state_inhibited: css({
      background: theme.colors.secondary.transparent,
      color: theme.colors.text.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
