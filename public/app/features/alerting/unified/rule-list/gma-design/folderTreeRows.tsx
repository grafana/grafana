import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, IconButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { makeFolderAlertsLink } from '../../utils/misc';
import { formatPrometheusDuration, safeParsePrometheusDuration } from '../../utils/time';
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';
import LoadMoreHelper from '../LoadMoreHelper';
import { STICKY_SECTION_HEADER_HEIGHT } from '../components/DataSourceSection';
import { type TreeRow } from '../hooks/useFolderTreeModel';
import { useK8sFolderCounts } from '../hooks/useK8sFolderCounts';

const HEADER_HEIGHT = 40;
const INDENT_STEP = 20;

interface FolderTreeRowProps {
  row: TreeRow;
  onToggle: (uid: string) => void;
  onToggleGroup: (folderUid: string, groupName: string) => void;
  onLoadMore: (uid: string) => void;
  onLoadMoreChildren: (uid: string) => void;
}

/** Renders a single flattened tree row by kind. Folder rows stick to the top, stacked by depth. */
export function FolderTreeRow({ row, onToggle, onToggleGroup, onLoadMore, onLoadMoreChildren }: FolderTreeRowProps) {
  const styles = useStyles2(getStyles);

  switch (row.kind) {
    case 'folder':
      return <FolderHeaderRow row={row} onToggle={onToggle} />;
    case 'group-header':
      return <GroupHeaderRow row={row} onToggleGroup={onToggleGroup} />;
    case 'group-label':
      return <GroupLabelRow row={row} />;
    case 'rule':
      return (
        <div className={styles.indentRow} style={{ paddingLeft: indentFor(row.level) }}>
          <GrafanaRuleListItem
            rule={row.rule.rule}
            groupIdentifier={row.rule.groupIdentifier}
            namespaceName={row.rule.namespaceName}
            showLocation={false}
            groupAsPill={row.groupAsPill}
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
      // Auto-loads the next page of rules when this sentinel scrolls into view.
      return (
        <div className={styles.placeholder} style={{ paddingLeft: indentFor(row.level) }}>
          {row.isLoading && (
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="alerting.k8s-folder.loading">Loading rules…</Trans>
            </Text>
          )}
          <LoadMoreHelper handleLoad={() => onLoadMore(row.folderUid)} />
        </div>
      );
    case 'children-loadmore':
      // Auto-loads the next page of child folders when this sentinel scrolls into view.
      return (
        <div className={styles.placeholder} style={{ paddingLeft: indentFor(row.level) }}>
          {row.isLoading && (
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="alerting.k8s-folder.loading-folders">Loading folders…</Trans>
            </Text>
          )}
          <LoadMoreHelper handleLoad={() => onLoadMoreChildren(row.folderUid)} />
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
      style={{
        paddingLeft: indentFor(row.level),
        // Stack below the pinned section header, then one header height per nesting level.
        top: STICKY_SECTION_HEADER_HEIGHT + row.level * HEADER_HEIGHT,
        zIndex: 100 - row.level,
      }}
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
      <FolderActionsButton folderUID={row.uid} folder={{ uid: row.uid, title: row.title }} />
    </div>
  );
}

interface GroupHeaderRowProps {
  row: Extract<TreeRow, { kind: 'group-header' }>;
  onToggleGroup: (folderUid: string, groupName: string) => void;
}

/** Option 1 (`rows`): a rule-group header. Collapsible style gets a chevron; inline style doesn't. */
function GroupHeaderRow({ row, onToggleGroup }: GroupHeaderRowProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.groupHeader} style={{ paddingLeft: indentFor(row.level) }}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        {row.style === 'collapsible' && (
          <IconButton
            name={row.isOpen ? 'angle-down' : 'angle-right'}
            onClick={() => onToggleGroup(row.folderUid, row.groupName)}
            aria-label={
              row.isOpen
                ? t('alerting.k8s-folder.collapse-group', 'Collapse group')
                : t('alerting.k8s-folder.expand-group', 'Expand group')
            }
          />
        )}
        <Icon name="layer-group" size="sm" />
        <TextLink href={row.href} color="primary" inline={false}>
          {row.groupName}
        </TextLink>
      </Stack>
    </div>
  );
}

/** Merged mode: a quiet, non-collapsible label for a multi-rule group, with count + eval interval. */
function GroupLabelRow({ row }: { row: Extract<TreeRow, { kind: 'group-label' }> }) {
  const styles = useStyles2(getStyles);
  const intervalLabel = row.interval ? formatPrometheusDuration(safeParsePrometheusDuration(row.interval)) : undefined;

  return (
    <div className={styles.groupLabel} style={{ paddingLeft: indentFor(row.level) }}>
      <TextLink href={row.href} color="secondary" variant="bodySmall" inline={false}>
        {row.groupName}
      </TextLink>
      <span className={styles.groupLabelMeta}>
        {intervalLabel && `· ${intervalLabel} `}
        {'· '}
        {t('alerting.k8s-folder.group-rule-count', '', {
          count: row.count,
          defaultValue_one: '{{count}} rule',
          defaultValue_other: '{{count}} rules',
        })}
      </span>
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
  groupHeader: css({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 1.5),
  }),
  groupLabel: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 1.5, 0.5),
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: theme.colors.text.secondary,
  }),
  groupLabelMeta: css({
    color: theme.colors.text.disabled,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: 400,
    fontVariantNumeric: 'tabular-nums',
  }),
  placeholder: css({
    padding: theme.spacing(1, 1.5),
  }),
});
