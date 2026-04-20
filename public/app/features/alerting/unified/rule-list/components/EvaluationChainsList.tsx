import { css } from '@emotion/css';
import { useState } from 'react';
import { useToggle } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Icon, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';

import { type EvaluationChain } from '../../types/evaluation-chain';

interface EvaluationChainsListProps {
  chains: EvaluationChain[];
  isLoading: boolean;
}

export function EvaluationChainsList({ chains, isLoading }: EvaluationChainsListProps) {
  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.evaluation-chains-list.loading', 'Loading groups...')} />;
  }

  if (chains.length === 0) {
    return (
      <Box padding={4}>
        <Text color="secondary">
          <Trans i18nKey="alerting.evaluation-chains-list.empty">
            No evaluation groups found. Evaluation groups are created when you link recording and alert rules together
            for sequential evaluation.
          </Trans>
        </Text>
      </Box>
    );
  }

  // Group chains by folder, preserving insertion order
  const folderMap = new Map<string, EvaluationChain[]>();
  for (const chain of chains) {
    const existing = folderMap.get(chain.folder);
    if (existing) {
      existing.push(chain);
    } else {
      folderMap.set(chain.folder, [chain]);
    }
  }

  return (
    <Stack direction="column" gap={0}>
      {Array.from(folderMap.entries()).map(([folder, folderChains]) => (
        <FolderSection key={folder} folder={folder} chains={folderChains} />
      ))}
    </Stack>
  );
}

function FolderSection({ folder, chains }: { folder: string; chains: EvaluationChain[] }) {
  const [collapsed, toggleCollapsed] = useToggle(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.folderSection}>
      <button className={styles.folderHeader} onClick={toggleCollapsed} type="button" aria-expanded={!collapsed}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name={collapsed ? 'angle-right' : 'angle-down'} size="sm" />
          <Icon name="folder" className={styles.folderIcon} size="sm" />
          <Text weight="medium">{folder}</Text>
          <Text variant="bodySmall" color="secondary">
            {t('alerting.evaluation-chains-list.folder-count', '{{count}} group', { count: chains.length })}
          </Text>
        </Stack>
      </button>
      {!collapsed && (
        <div className={styles.folderBody}>
          {chains.map((chain) => (
            <EvaluationChainRow key={chain.uid} chain={chain} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvaluationChainRow({ chain }: { chain: EvaluationChain }) {
  const [expanded, setExpanded] = useState(false);
  const styles = useStyles2(getStyles);
  const recordingCount = chain.recordingRuleRefs.length;
  const alertCount = chain.alertRuleRefs.length;

  return (
    <div className={styles.chainRow}>
      <button
        className={styles.chainHeader}
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
      >
        <Stack direction="row" alignItems="center" gap={1} grow={1}>
          <Icon name={expanded ? 'angle-down' : 'angle-right'} size="sm" />
          <Icon name="link" className={styles.chainIcon} size="sm" />
          <Text weight="medium">{chain.name}</Text>
          <Stack direction="row" gap={0.5} alignItems="center">
            <span className={styles.badge}>{chain.interval}</span>
            {recordingCount > 0 && (
              <span className={`${styles.badge} ${styles.recordingBadge}`}>
                {t('alerting.evaluation-chain-row.recording-count', '{{count}} recording rule', {
                  count: recordingCount,
                })}
              </span>
            )}
            {alertCount > 0 && (
              <span className={`${styles.badge} ${styles.alertBadge}`}>
                {t('alerting.evaluation-chain-row.alert-count', '{{count}} alert rule', { count: alertCount })}
              </span>
            )}
          </Stack>
        </Stack>
      </button>

      {expanded && (
        <div className={styles.chainBody}>
          {recordingCount > 0 && (
            <div className={styles.ruleGroup}>
              <Stack direction="row" gap={0.5} alignItems="center">
                <Icon name="record-audio" size="xs" className={styles.recordingIcon} />
                <Text variant="bodySmall" color="secondary" weight="bold">
                  <Trans i18nKey="alerting.evaluation-chain-row.recording-rules">Recording rules</Trans>
                </Text>
              </Stack>
              {chain.recordingRuleRefs.map((name, index) => (
                <div key={name} className={styles.ruleItem}>
                  <Text variant="bodySmall" color="secondary">
                    {index + 1}.
                  </Text>
                  <Text variant="bodySmall">{name}</Text>
                </div>
              ))}
            </div>
          )}
          {alertCount > 0 && (
            <div className={styles.ruleGroup}>
              <Stack direction="row" gap={0.5} alignItems="center">
                <Icon name="bell" size="xs" className={styles.alertIcon} />
                <Text variant="bodySmall" color="secondary" weight="bold">
                  <Trans i18nKey="alerting.evaluation-chain-row.alert-rules">Alert rules</Trans>
                </Text>
              </Stack>
              {chain.alertRuleRefs.map((name, index) => (
                <div key={name} className={styles.ruleItem}>
                  <Text variant="bodySmall" color="secondary">
                    {recordingCount + index + 1}.
                  </Text>
                  <Text variant="bodySmall">{name}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    folderSection: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      '&:last-child': {
        borderBottom: 'none',
      },
    }),
    folderHeader: css({
      width: '100%',
      padding: theme.spacing(1, 1.5),
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    folderIcon: css({
      color: theme.colors.text.secondary,
    }),
    folderBody: css({
      paddingLeft: theme.spacing(3),
    }),
    chainRow: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    chainHeader: css({
      width: '100%',
      padding: theme.spacing(1, 1.5),
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    chainIcon: css({
      color: theme.colors.warning.text,
      flexShrink: 0,
    }),
    chainBody: css({
      padding: theme.spacing(1, 2, 1.5, 5),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
    }),
    ruleGroup: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    ruleItem: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      paddingLeft: theme.spacing(2),
    }),
    badge: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.pill,
      padding: `1px ${theme.spacing(0.75)}`,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    recordingBadge: css({
      color: theme.colors.info.text,
      borderColor: theme.colors.info.border,
      backgroundColor: theme.colors.info.transparent,
    }),
    alertBadge: css({
      color: theme.colors.warning.text,
      borderColor: theme.colors.warning.border,
      backgroundColor: theme.colors.warning.transparent,
    }),
    recordingIcon: css({
      color: theme.colors.info.text,
    }),
    alertIcon: css({
      color: theme.colors.warning.text,
    }),
  };
}
