import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { Spacer } from '../../components/Spacer';
import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeFolderAlertsLink } from '../../utils/misc';
import { groups } from '../../utils/navigation';
import { formatPrometheusDuration, safeParsePrometheusDuration } from '../../utils/time';
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';
import { ListGroup } from '../components/ListGroup';
import { type GroupRowStyle, type GroupedRules, groupRulesByGroup, useGroupDisplayParams } from '../groupDisplay';
import { type GrafanaRuleWithOrigin } from '../hooks/useFilteredRulesIterator';
import { type K8sRuleFilter } from '../hooks/useK8sFolderRules';
import { useK8sFolderSearchRules } from '../hooks/useK8sFolderSearchRules';
import { type FolderRuleTreeNode } from '../hooks/useK8sFoldersWithRules';

import { getRuleDesignStyles } from './styles';

interface K8sSearchFolderCardProps {
  folderUid: string;
  folderTitle: string;
  groupFilter?: string;
  ruleFilter?: K8sRuleFilter;
  defaultOpen?: boolean;
  /** Nested rule-bearing folders, rendered (and revealed) when this folder is expanded. */
  childFolders?: FolderRuleTreeNode[];
  /** Rules directly in this folder, from the facet. Shown in the count badge without a per-folder fetch. */
  ruleCount?: number;
}

/**
 * Grouped-view folder card backed by the single cross-kind k8s `/search` endpoint. Issues
 * one request for both alert + recording rules and renders a flat, definition-only list.
 */
export function K8sSearchFolderCard({
  folderUid,
  folderTitle,
  groupFilter,
  ruleFilter,
  defaultOpen = false,
  childFolders,
  ruleCount,
}: K8sSearchFolderCardProps) {
  const styles = useStyles2(getRuleDesignStyles);
  const [open, setOpen] = useState(defaultOpen);

  const { mode, rowStyle } = useGroupDisplayParams();
  // `rows` and `merged` both need group-contiguous results, so they sort by group and use the
  // group-aware container. `pill` and `flat` keep the plain flat list.
  const groupedLayout = mode === 'rows' || mode === 'merged';
  const groupAsPill = mode === 'pill';

  const { rules, hasMore, isLoading, isInitialLoading, loadMore, error, loadedCount } = useK8sFolderSearchRules(
    folderUid,
    folderTitle,
    groupFilter,
    ruleFilter,
    groupedLayout
  );

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
          </Stack>
          <Spacer />
          <span className={styles.frules}>
            <Trans
              i18nKey="alerting.k8s-folder.rule-count"
              count={ruleCount ?? loadedCount}
              tOptions={{ defaultValue_one: '{{count}} rule', defaultValue_other: '{{count}} rules' }}
            >
              {'{{count}}'} rules
            </Trans>
          </span>
          <FolderActionsButton folderUID={folderUid} />
        </Stack>
      </div>

      {open && (
        <div className={groupedLayout ? styles.groupRulesContainer : styles.rulesContainer}>
          {childFolders?.map((child) => (
            <K8sSearchFolderCard
              key={child.uid}
              folderUid={child.uid}
              folderTitle={child.title}
              groupFilter={groupFilter}
              ruleFilter={ruleFilter}
              childFolders={child.children}
              ruleCount={child.directRuleCount}
            />
          ))}
          {Boolean(error) && (
            <Text color="error">
              <Trans i18nKey="alerting.k8s-folder.error">Failed to load rules for this folder</Trans>
            </Text>
          )}
          {!error && isInitialLoading && (
            <Text color="secondary">
              <Trans i18nKey="alerting.k8s-folder.loading">Loading rules…</Trans>
            </Text>
          )}
          {!error && !isInitialLoading && mode === 'rows' && (
            <FolderGroupRows
              grouped={groupRulesByGroup(rules)}
              folderUid={folderUid}
              rowStyle={rowStyle}
              styles={styles}
            />
          )}
          {!error && !isInitialLoading && mode === 'merged' && (
            <MergedFolderGroupRows grouped={groupRulesByGroup(rules)} folderUid={folderUid} styles={styles} />
          )}
          {!error && !isInitialLoading && !groupedLayout && (
            <ul>
              {rules.map((ruleWithOrigin) => (
                <GrafanaRuleListItem
                  key={`${ruleWithOrigin.groupIdentifier.namespace.uid}-${ruleWithOrigin.groupIdentifier.groupName}-${ruleWithOrigin.rule.uid}`}
                  rule={ruleWithOrigin.rule}
                  groupIdentifier={ruleWithOrigin.groupIdentifier}
                  namespaceName={ruleWithOrigin.namespaceName}
                  showLocation={false}
                  groupAsPill={groupAsPill}
                  interval={ruleWithOrigin.interval}
                />
              ))}
            </ul>
          )}

          {hasMore && (
            <div className={styles.loadMore}>
              <Button variant="secondary" fill="outline" size="sm" onClick={loadMore} disabled={isLoading}>
                {isLoading ? (
                  <Trans i18nKey="alerting.k8s-folder.loading-short">Loading…</Trans>
                ) : (
                  <Trans i18nKey="alerting.k8s-folder.load-more">Load more</Trans>
                )}
              </Button>
              <span className={styles.loadMoreMeta}>
                {t('alerting.k8s-folder.loaded-count', '', {
                  count: loadedCount,
                  defaultValue_one: '{{count}} loaded',
                  defaultValue_other: '{{count}} loaded',
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FolderGroupRowsProps {
  grouped: GroupedRules;
  folderUid: string;
  rowStyle: GroupRowStyle;
  styles: ReturnType<typeof getRuleDesignStyles>;
}

/**
 * Option 1: renders each rule group under its own header, with ungrouped rules listed directly.
 * Headers and rules are emitted as direct children (no intermediate <ul>) so the parent
 * container's indentation selectors line everything up. Collapsible groups start collapsed.
 */
function FolderGroupRows({ grouped, folderUid, rowStyle, styles }: FolderGroupRowsProps) {
  return (
    <>
      {grouped.groups.map(({ groupName, rules }) => {
        const groupUrl = groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, folderUid, groupName);

        if (rowStyle === 'inline') {
          return (
            <div key={groupName} role="treeitem" aria-selected="false">
              <InlineGroupHeader name={groupName} href={groupUrl} className={styles.inlineGroupHeader} />
              {rules.map((rule) => renderGroupedRule(rule))}
            </div>
          );
        }

        return (
          <ListGroup key={groupName} name={groupName} href={groupUrl} isOpen={false}>
            {rules.map((rule) => renderGroupedRule(rule))}
          </ListGroup>
        );
      })}
      {grouped.ungrouped.map((rule) => renderGroupedRule(rule))}
    </>
  );
}

interface MergedFolderGroupRowsProps {
  grouped: GroupedRules;
  folderUid: string;
  styles: ReturnType<typeof getRuleDesignStyles>;
}

/**
 * Merged mode: a single-rule group collapses to just its rule with a group pill (no header
 * earns its place for one rule); a multi-rule group gets a quiet, non-collapsible section
 * label. Ungrouped rules render directly.
 */
function MergedFolderGroupRows({ grouped, folderUid, styles }: MergedFolderGroupRowsProps) {
  return (
    <>
      {grouped.groups.map(({ groupName, rules }) => {
        const groupUrl = groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, folderUid, groupName);

        if (rules.length === 1) {
          return renderGroupedRule(rules[0], true);
        }

        return (
          <div key={groupName} role="treeitem" aria-selected="false">
            <MergedGroupLabel
              name={groupName}
              href={groupUrl}
              count={rules.length}
              interval={rules[0]?.interval}
              styles={styles}
            />
            {rules.map((rule) => renderGroupedRule(rule))}
          </div>
        );
      })}
      {/* Ungrouped rules still surface their eval interval via the chip, for visual consistency. */}
      {grouped.ungrouped.map((rule) => renderGroupedRule(rule, true))}
    </>
  );
}

function renderGroupedRule(ruleWithOrigin: GrafanaRuleWithOrigin, groupAsPill = false) {
  return (
    <GrafanaRuleListItem
      key={`${ruleWithOrigin.groupIdentifier.namespace.uid}-${ruleWithOrigin.groupIdentifier.groupName}-${ruleWithOrigin.rule.uid}`}
      rule={ruleWithOrigin.rule}
      groupIdentifier={ruleWithOrigin.groupIdentifier}
      namespaceName={ruleWithOrigin.namespaceName}
      showLocation={false}
      groupAsPill={groupAsPill}
      interval={ruleWithOrigin.interval}
    />
  );
}

function MergedGroupLabel({
  name,
  href,
  count,
  interval,
  styles,
}: {
  name: string;
  href: string;
  count: number;
  interval?: string;
  styles: ReturnType<typeof getRuleDesignStyles>;
}) {
  const intervalLabel = interval ? formatPrometheusDuration(safeParsePrometheusDuration(interval)) : undefined;

  return (
    <div className={styles.mergedGroupLabel}>
      <TextLink href={href} color="secondary" variant="bodySmall" inline={false}>
        {name}
      </TextLink>
      <span className={styles.mergedGroupCount}>
        {intervalLabel && `· ${intervalLabel} `}
        {'· '}
        {t('alerting.k8s-folder.group-rule-count', '', {
          count,
          defaultValue_one: '{{count}} rule',
          defaultValue_other: '{{count}} rules',
        })}
      </span>
    </div>
  );
}

function InlineGroupHeader({ name, href, className }: { name: string; href: string; className: string }) {
  return (
    <div className={className}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="layer-group" size="sm" />
        <TextLink href={href} color="primary" inline={false}>
          {name}
        </TextLink>
      </Stack>
    </div>
  );
}
