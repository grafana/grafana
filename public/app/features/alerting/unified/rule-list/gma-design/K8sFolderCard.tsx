import { cx } from '@emotion/css';
import { useState } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { Spacer } from '../../components/Spacer';
import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { makeFolderAlertsLink } from '../../utils/misc';
import {
  type K8sRuleFilter,
  type PaginatedKind,
  type RecordingSplitMode,
  useK8sFolderRules,
} from '../hooks/useK8sFolderRules';

import { K8sRuleRow, type RuleKind } from './K8sRuleRow';
import { getRuleDesignStyles } from './styles';

interface K8sFolderCardProps {
  folderUid: string;
  folderTitle: string;
  treatment: RecordingSplitMode;
  groupFilter?: string;
  ruleFilter?: K8sRuleFilter;
  showDesc?: boolean;
  density?: 'compact' | 'comfy';
  /** When set, renders a single rule kind flat (used by the top-level 'tabbed' treatment). */
  singleKind?: RuleKind;
  defaultOpen?: boolean;
}

/** Returns the only rule kind a filter can match, or undefined when both kinds are possible. */
function singleKindForFilter(ruleFilter?: K8sRuleFilter): RuleKind | undefined {
  if (ruleFilter?.ruleType === PromRuleType.Recording) {
    return 'recording';
  }
  if (ruleFilter?.ruleType === PromRuleType.Alerting || ruleFilter?.dashboardUid || ruleFilter?.contactPoint) {
    return 'alerting';
  }
  return undefined;
}

export function K8sFolderCard({
  folderUid,
  folderTitle,
  treatment,
  groupFilter,
  ruleFilter,
  showDesc = true,
  density = 'comfy',
  singleKind,
  defaultOpen = false,
}: K8sFolderCardProps) {
  const styles = useStyles2(getRuleDesignStyles);
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<RuleKind>('alerting');
  const [recOpen, setRecOpen] = useState(false);

  const { alerting, recording, hasRecording, isInitialLoading, error } = useK8sFolderRules(
    folderUid,
    groupFilter,
    ruleFilter
  );

  // A filter that can only match one kind collapses the card to that kind's flat list.
  const effectiveSingleKind: RuleKind | undefined = singleKind ?? singleKindForFilter(ruleFilter);

  const showHeaderTabs = !effectiveSingleKind && hasRecording && treatment === 'header-tabs';

  return (
    <div className={styles.folder}>
      <div className={styles.folderHead}>
        <Stack alignItems="center">
          <Stack alignItems="center" gap={0.5}>
            <IconButton
              name={open ? 'angle-down' : 'angle-right'}
              onClick={() => setOpen((o) => !o)}
              aria-label={t('common.collapse', 'Collapse')}
            />
            <Icon name="folder" />
            <TextLink href={makeFolderAlertsLink(folderUid, folderTitle)} inline={false} color="primary">
              {folderTitle}
            </TextLink>
            {showHeaderTabs && (
              <div className={styles.headerTabs}>
                <button
                  type="button"
                  className={cx(styles.headerTab, tab === 'alerting' && styles.headerTabOn)}
                  onClick={() => setTab('alerting')}
                >
                  <Trans i18nKey="alerting.k8s-folder.alerting">Alerting</Trans>{' '}
                  <span className={styles.tabCount}>{alerting.countLabel}</span>
                </button>
                <button
                  type="button"
                  className={cx(styles.headerTab, tab === 'recording' && styles.headerTabOn)}
                  onClick={() => setTab('recording')}
                >
                  ƒ <Trans i18nKey="alerting.k8s-folder.recording">Recording</Trans>{' '}
                  <span className={styles.tabCount}>{recording.countLabel}</span>
                </button>
              </div>
            )}
          </Stack>
          <Spacer />
          {!showHeaderTabs && (
            <FolderCountLabel
              singleKind={effectiveSingleKind}
              alerting={alerting}
              recording={recording}
              hasRecording={hasRecording}
              styles={styles}
            />
          )}
          <FolderActionsButton folderUID={folderUid} />
        </Stack>
      </div>

      {open && (
        <FolderBody
          treatment={treatment}
          singleKind={effectiveSingleKind}
          hasRecording={hasRecording}
          tab={tab}
          recOpen={recOpen}
          setRecOpen={setRecOpen}
          alerting={alerting}
          recording={recording}
          showDesc={showDesc}
          density={density}
          isInitialLoading={isInitialLoading}
          error={error}
        />
      )}
    </div>
  );
}

function FolderCountLabel({
  singleKind,
  alerting,
  recording,
  hasRecording,
  styles,
}: {
  singleKind?: RuleKind;
  alerting: PaginatedKind<AlertRule>;
  recording: PaginatedKind<RecordingRule>;
  hasRecording: boolean;
  styles: ReturnType<typeof getRuleDesignStyles>;
}) {
  if (singleKind) {
    const k = singleKind === 'recording' ? recording : alerting;
    return (
      <span className={styles.frules}>
        {t('alerting.k8s-folder.rule-count', '{{count}} rules', { count: k.countLabel })}
      </span>
    );
  }

  if (hasRecording && alerting.loadedCount > 0) {
    return (
      <span className={styles.frules}>
        {t('alerting.k8s-folder.alerting-count', '{{count}} alerting', { count: alerting.countLabel })}
        <span className={styles.frulesSep}>·</span>
        <span className={styles.recCount}>
          {t('alerting.k8s-folder.recording-count', '{{count}} recording', { count: recording.countLabel })}
        </span>
      </span>
    );
  }

  const only = hasRecording ? recording : alerting;
  return (
    <span className={styles.frules}>
      {t('alerting.k8s-folder.rule-count', '{{count}} rules', { count: only.countLabel })}
    </span>
  );
}

interface FolderBodyProps {
  treatment: RecordingSplitMode;
  singleKind?: RuleKind;
  hasRecording: boolean;
  tab: RuleKind;
  recOpen: boolean;
  setRecOpen: (fn: (o: boolean) => boolean) => void;
  alerting: PaginatedKind<AlertRule>;
  recording: PaginatedKind<RecordingRule>;
  showDesc: boolean;
  density: 'compact' | 'comfy';
  isInitialLoading: boolean;
  error: unknown;
}

function FolderBody({
  treatment,
  singleKind,
  hasRecording,
  tab,
  recOpen,
  setRecOpen,
  alerting,
  recording,
  showDesc,
  density,
  isInitialLoading,
  error,
}: FolderBodyProps) {
  const styles = useStyles2(getRuleDesignStyles);

  if (error) {
    return (
      <div className={styles.rulesContainer}>
        <Text color="error">
          <Trans i18nKey="alerting.k8s-folder.error">Failed to load rules for this folder</Trans>
        </Text>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className={styles.rulesContainer}>
        <Text color="secondary">
          <Trans i18nKey="alerting.k8s-folder.loading">Loading rules…</Trans>
        </Text>
      </div>
    );
  }

  // Single-kind (top-level tabbed) — flat list of just that kind.
  if (singleKind) {
    return (
      <div className={styles.rulesContainer}>
        {singleKind === 'recording' ? (
          <PaginatedRuleList page={recording} kind="recording" showDesc={showDesc} density={density} />
        ) : (
          <PaginatedRuleList page={alerting} kind="alerting" showDesc={showDesc} density={density} />
        )}
      </div>
    );
  }

  // No recording rules — flat alerting list, no extra UI in any treatment.
  if (!hasRecording) {
    return (
      <div className={styles.rulesContainer}>
        <PaginatedRuleList page={alerting} kind="alerting" showDesc={showDesc} density={density} />
      </div>
    );
  }

  if (treatment === 'header-tabs') {
    return (
      <div className={styles.rulesContainer}>
        {tab === 'alerting' ? (
          <PaginatedRuleList page={alerting} kind="alerting" showDesc={showDesc} density={density} />
        ) : (
          <PaginatedRuleList page={recording} kind="recording" showDesc={showDesc} density={density} />
        )}
      </div>
    );
  }

  if (treatment === 'nested-tabs') {
    return <NestedTabs alerting={alerting} recording={recording} showDesc={showDesc} density={density} />;
  }

  if (treatment === 'inline-divider') {
    return (
      <div className={styles.rulesContainer}>
        <PaginatedRuleList page={alerting} kind="alerting" showDesc={showDesc} density={density} />
        <button type="button" className={styles.inlineDivider} onClick={() => setRecOpen((o) => !o)}>
          <Icon name={recOpen ? 'angle-down' : 'angle-right'} size="sm" />
          <span>
            <Trans i18nKey="alerting.k8s-folder.recording-rules">Recording rules</Trans>
          </span>
          <span className={styles.inlineDividerCount}>{recording.countLabel}</span>
          <span className={styles.inlineDividerHairline} />
        </button>
        {recOpen && <PaginatedRuleList page={recording} kind="recording" showDesc={showDesc} density={density} />}
      </div>
    );
  }

  if (treatment === 'mixed-badged') {
    return (
      <div className={styles.rulesContainer}>
        <PaginatedRuleList page={alerting} kind="alerting" showDesc={showDesc} density={density} />
        <PaginatedRuleList page={recording} kind="recording" showDesc={showDesc} density={density} dim />
      </div>
    );
  }

  // folder-chip
  return (
    <>
      <div className={styles.rulesContainer}>
        <PaginatedRuleList page={alerting} kind="alerting" showDesc={showDesc} density={density} />
      </div>
      <div className={styles.chipBar}>
        <button
          type="button"
          className={cx(styles.recChip, recOpen && styles.recChipOn)}
          onClick={() => setRecOpen((o) => !o)}
        >
          ƒ
          <span>
            {recOpen
              ? t('alerting.k8s-folder.hide-recording', 'Hide {{count}} recording rules', {
                  count: recording.countLabel,
                })
              : t('alerting.k8s-folder.show-recording', 'Show {{count}} recording rules', {
                  count: recording.countLabel,
                })}
          </span>
          <Icon name={recOpen ? 'angle-up' : 'angle-down'} size="sm" />
        </button>
      </div>
      {recOpen && (
        <div className={cx(styles.rulesContainer, styles.recBlock)}>
          <PaginatedRuleList page={recording} kind="recording" showDesc={showDesc} density={density} />
        </div>
      )}
    </>
  );
}

function NestedTabs({
  alerting,
  recording,
  showDesc,
  density,
}: {
  alerting: PaginatedKind<AlertRule>;
  recording: PaginatedKind<RecordingRule>;
  showDesc: boolean;
  density: 'compact' | 'comfy';
}) {
  const styles = useStyles2(getRuleDesignStyles);
  const [tab, setTab] = useState<RuleKind>('alerting');

  return (
    <>
      <div className={styles.folderTabs}>
        <button
          type="button"
          className={cx(styles.folderTab, tab === 'alerting' && styles.folderTabOn)}
          onClick={() => setTab('alerting')}
        >
          <Trans i18nKey="alerting.k8s-folder.alerting">Alerting</Trans>{' '}
          <span className={styles.tabCount}>{alerting.countLabel}</span>
        </button>
        <button
          type="button"
          className={cx(styles.folderTab, tab === 'recording' && styles.folderTabOn)}
          onClick={() => setTab('recording')}
        >
          <Trans i18nKey="alerting.k8s-folder.recording">Recording</Trans>{' '}
          <span className={styles.tabCount}>{recording.countLabel}</span>
        </button>
      </div>
      <div className={styles.rulesContainer}>
        {tab === 'alerting' ? (
          <PaginatedRuleList page={alerting} kind="alerting" showDesc={showDesc} density={density} />
        ) : (
          <PaginatedRuleList page={recording} kind="recording" showDesc={showDesc} density={density} />
        )}
      </div>
    </>
  );
}

type PaginatedRuleListProps = {
  showDesc: boolean;
  density: 'compact' | 'comfy';
  dim?: boolean;
} & ({ kind: 'alerting'; page: PaginatedKind<AlertRule> } | { kind: 'recording'; page: PaginatedKind<RecordingRule> });

function PaginatedRuleList(props: PaginatedRuleListProps) {
  const { page, showDesc, density, dim } = props;
  const styles = useStyles2(getRuleDesignStyles);

  return (
    <>
      {props.kind === 'alerting'
        ? props.page.items.map((rule) => (
            <K8sRuleRow
              key={rule.metadata.name}
              rule={rule}
              kind="alerting"
              showDesc={showDesc}
              density={density}
              dim={dim}
            />
          ))
        : props.page.items.map((rule) => (
            <K8sRuleRow
              key={rule.metadata.name}
              rule={rule}
              kind="recording"
              showDesc={showDesc}
              density={density}
              dim={dim}
            />
          ))}
      {page.hasMore && (
        <div className={styles.loadMore}>
          <Button variant="secondary" fill="outline" size="sm" onClick={page.loadMore} disabled={page.isLoading}>
            {page.isLoading ? (
              <Trans i18nKey="alerting.k8s-folder.loading-short">Loading…</Trans>
            ) : (
              <Trans i18nKey="alerting.k8s-folder.load-more">Load more</Trans>
            )}
          </Button>
          <span className={styles.loadMoreMeta}>
            {t('alerting.k8s-folder.loaded-count', '{{count}} loaded', { count: page.loadedCount })}
          </span>
        </div>
      )}
      {!page.hasMore && page.loadedCount > 0 && (
        <div className={styles.loadMore}>
          <span className={styles.loadMoreMeta}>
            {t('alerting.k8s-folder.end-of-list', 'End of list — {{count}} rules loaded', {
              count: page.loadedCount,
            })}
          </span>
        </div>
      )}
    </>
  );
}
