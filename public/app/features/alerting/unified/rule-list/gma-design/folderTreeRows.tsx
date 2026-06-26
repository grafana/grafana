import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { makeFolderAlertsLink } from '../../utils/misc';
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';
import { type TreeRow } from '../hooks/useFolderTreeModel';
import { useK8sFolderCounts } from '../hooks/useK8sFolderCounts';

const HEADER_HEIGHT = 40;
const INDENT_STEP = 20;

interface FolderTreeRowProps {
  row: TreeRow;
  onToggle: (uid: string) => void;
  onLoadMore: (uid: string) => void;
}

/** Renders a single flattened tree row by kind. Folder rows stick to the top, stacked by depth. */
export function FolderTreeRow({ row, onToggle, onLoadMore }: FolderTreeRowProps) {
  const styles = useStyles2(getStyles);

  switch (row.kind) {
    case 'folder':
      return <FolderHeaderRow row={row} onToggle={onToggle} />;
    case 'rule':
      return (
        <div className={styles.indentRow} style={{ paddingLeft: indentFor(row.level) }}>
          <GrafanaRuleListItem
            rule={row.rule.rule}
            groupIdentifier={row.rule.groupIdentifier}
            namespaceName={row.rule.namespaceName}
            showLocation={false}
            groupAsPill
            interval={row.rule.interval}
          />
        </div>
      );
    case 'rules-loading':
      return (
        <div className={styles.placeholder} style={{ paddingLeft: indentFor(row.level) }}>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.k8s-folder.loading">Loading rules…</Trans>
          </Text>
        </div>
      );
    case 'rules-error':
      return (
        <div className={styles.placeholder} style={{ paddingLeft: indentFor(row.level) }}>
          <Text color="error" variant="bodySmall">
            <Trans i18nKey="alerting.k8s-folder.error">Failed to load rules for this folder</Trans>
          </Text>
        </div>
      );
    case 'empty':
      return (
        <div className={styles.placeholder} style={{ paddingLeft: indentFor(row.level) }}>
          <Text color="secondary" variant="bodySmall" italic>
            <Trans i18nKey="alerting.k8s-folder.empty">No rules or subfolders</Trans>
          </Text>
        </div>
      );
    case 'rules-loadmore':
      return (
        <div className={styles.loadMore} style={{ paddingLeft: indentFor(row.level) }}>
          <Button
            variant="secondary"
            fill="outline"
            size="sm"
            onClick={() => onLoadMore(row.folderUid)}
            disabled={row.isLoading}
          >
            {row.isLoading ? (
              <Trans i18nKey="alerting.k8s-folder.loading-short">Loading…</Trans>
            ) : (
              <Trans i18nKey="alerting.k8s-folder.load-more">Load more</Trans>
            )}
          </Button>
          <span className={styles.loadMoreMeta}>
            {t('alerting.k8s-folder.loaded-count', '', {
              count: row.loadedCount,
              defaultValue_one: '{{count}} loaded',
              defaultValue_other: '{{count}} loaded',
            })}
          </span>
        </div>
      );
    default:
      return null;
  }
}

interface FolderHeaderRowProps {
  row: Extract<TreeRow, { kind: 'folder' }>;
  onToggle: (uid: string) => void;
}

function FolderHeaderRow({ row, onToggle }: FolderHeaderRowProps) {
  const styles = useStyles2(getStyles);
  const { alertRuleCount, recordingRuleCount } = useK8sFolderCounts(row.uid);

  return (
    <div
      className={styles.folderHead}
      style={{ paddingLeft: indentFor(row.level), top: row.level * HEADER_HEIGHT, zIndex: 100 - row.level }}
    >
      <Stack alignItems="center" gap={0.5}>
        <IconButton
          name={row.isOpen ? 'angle-down' : 'angle-right'}
          onClick={() => onToggle(row.uid)}
          aria-label={
            row.isOpen
              ? t('alerting.k8s-folder.collapse', 'Collapse folder')
              : t('alerting.k8s-folder.expand', 'Expand folder')
          }
        />
        <Icon name="folder" />
        <TextLink href={makeFolderAlertsLink(row.uid, row.title)} inline={false} color="primary">
          {row.title}
        </TextLink>
      </Stack>
      <span className={styles.spacer} />
      <span className={styles.counts}>
        {t('alerting.k8s-folder.alerting-count', '', {
          count: alertRuleCount,
          defaultValue_one: '{{count}} alerting',
          defaultValue_other: '{{count}} alerting',
        })}
        <span className={styles.countsSep}>·</span>
        {t('alerting.k8s-folder.recording-count', '', {
          count: recordingRuleCount,
          defaultValue_one: '{{count}} recording',
          defaultValue_other: '{{count}} recording',
        })}
      </span>
      <FolderActionsButton folderUID={row.uid} />
    </div>
  );
}

function indentFor(level: number): number {
  return level * INDENT_STEP;
}

const getStyles = (theme: GrafanaTheme2) => ({
  folderHead: css({
    position: 'sticky',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: HEADER_HEIGHT,
    padding: theme.spacing(0, 1.5),
    // Use the page container background so the header is opaque (rows don't show through when it's
    // pinned) while still matching the surrounding page surface.
    background: theme.colors.background.page,
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  spacer: css({ flex: 1 }),
  counts: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }),
  countsSep: css({
    margin: theme.spacing(0, 0.75),
  }),
  indentRow: css({}),
  placeholder: css({
    padding: theme.spacing(1, 1.5),
  }),
  loadMore: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
  }),
  loadMoreMeta: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
  }),
});
