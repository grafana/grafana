import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';
import { RuleDetailsDrawer } from '../rule-details/RuleDetailsDrawer';
import { AlertRuleInstances } from '../scene/AlertRuleInstances';
import { AlertRuleSummary } from '../scene/AlertRuleSummary';
import { type AlertRuleRow as AlertRuleRowType } from '../types';

import { AlertRuleRowActions } from './AlertRuleRowActions';
import { GenericRow } from './GenericRow';
import { RowActions } from './InstanceCountBadges';

interface AlertRuleRowProps {
  row: AlertRuleRowType;
  leftColumnWidth: number;
  rowKey: React.Key;
  depth?: number;
  enableFolderMeta?: boolean;
  groupLabels?: Record<string, string>;
}

export function AlertRuleRow({
  row,
  leftColumnWidth,
  rowKey,
  depth = 0,
  enableFolderMeta = true,
  groupLabels,
}: AlertRuleRowProps) {
  const styles = useStyles2(getStyles);
  const { ruleUID, folder, title } = row.metadata;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleDrawerOpen = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  return (
    <>
      <GenericRow
        key={rowKey}
        width={leftColumnWidth}
        title={
          <button
            type="button"
            className={styles.ruleName}
            onClick={handleDrawerOpen}
            data-testid={selectors.pages.Alerting.Triage.ruleNameButton}
            aria-label={t('alerting.triage.rule-details-aria-label', 'Open details for {{ruleName}}', {
              ruleName: title,
            })}
          >
            <Text variant="body">{title}</Text>
          </button>
        }
        actions={
          <RowActions
            counts={row.instanceCounts}
            actionButton={<AlertRuleRowActions ruleUID={ruleUID} ruleName={title} />}
          />
        }
        metadata={
          enableFolderMeta ? (
            <Stack direction="row" gap={0.5} alignItems="center">
              <MetaText icon="folder" />
              <Text variant="bodySmall" color="secondary">
                {folder}
              </Text>
            </Stack>
          ) : undefined
        }
        content={<AlertRuleSummary ruleUID={ruleUID} />}
        depth={depth}
        showIndentBorder
        expandable={false}
      >
        <AlertRuleInstances ruleUID={ruleUID} depth={depth} groupLabels={groupLabels} />
      </GenericRow>

      {isDrawerOpen && <RuleDetailsDrawer ruleUID={ruleUID} onClose={handleDrawerClose} />}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The rule name opens the details sidebar. Strip the browser's button styling so it still
  // reads as the row's title rather than as a control.
  ruleName: css({
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    textAlign: 'left',
    cursor: 'pointer',
    color: theme.colors.text.primary,
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
