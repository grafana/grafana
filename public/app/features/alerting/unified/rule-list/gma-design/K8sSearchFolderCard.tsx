import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { Spacer } from '../../components/Spacer';
import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { makeFolderAlertsLink } from '../../utils/misc';
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';
import { type K8sRuleFilter } from '../hooks/useK8sFolderRules';
import { useK8sFolderSearchRules } from '../hooks/useK8sFolderSearchRules';

import { getRuleDesignStyles } from './styles';

interface K8sSearchFolderCardProps {
  folderUid: string;
  folderTitle: string;
  groupFilter?: string;
  ruleFilter?: K8sRuleFilter;
  defaultOpen?: boolean;
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
}: K8sSearchFolderCardProps) {
  const styles = useStyles2(getRuleDesignStyles);
  const [open, setOpen] = useState(defaultOpen);

  const { rules, hasMore, isLoading, isInitialLoading, loadMore, error, countLabel, loadedCount } =
    useK8sFolderSearchRules(folderUid, folderTitle, groupFilter, ruleFilter);

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
            {t('alerting.k8s-folder.rule-count', '', {
              count: countLabel,
              defaultValue_one: '{{count}} rule',
              defaultValue_other: '{{count}} rules',
            })}
          </span>
          <FolderActionsButton folderUID={folderUid} />
        </Stack>
      </div>

      {open && (
        <div className={styles.rulesContainer}>
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
          {!error && !isInitialLoading && (
            <ul>
              {rules.map((ruleWithOrigin) => (
                <GrafanaRuleListItem
                  key={`${ruleWithOrigin.groupIdentifier.namespace.uid}-${ruleWithOrigin.groupIdentifier.groupName}-${ruleWithOrigin.rule.uid}`}
                  rule={ruleWithOrigin.rule}
                  groupIdentifier={ruleWithOrigin.groupIdentifier}
                  namespaceName={ruleWithOrigin.namespaceName}
                  showLocation={false}
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
