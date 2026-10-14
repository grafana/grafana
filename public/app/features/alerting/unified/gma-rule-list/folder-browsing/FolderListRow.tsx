import { css } from '@emotion/css';
import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { FolderPath } from '../rule-row/FolderPath';

import { makeFolderRulesLink } from './folderLinks';
import { type FolderRuleCount, useFolderPath } from './folderLookups';

interface FolderListRowProps {
  folderUid: string;
  /** Folder's own title from the folder search hit, so the row is readable before `/parents` resolves. */
  title: string;
  /** Which rule kind the count refers to; only used for the count label. */
  kind: 'alert' | 'recording';
  /** The rule kind's direct count for this folder (e.g. Alert rules only, never descendant/Recording counts). */
  count: FolderRuleCount;
  expanded: boolean;
  onToggle: () => void;
  /** Rendered only while expanded - the folder's own rule-search results. */
  children?: ReactNode;
}

/**
 * Shared Folders-mode row (renders its own `<li>`): chevron, folder title linking to the folder's
 * alert view, the parent path for nested folders, and the rule-kind-specific direct count.
 * Expandable to show that folder's rules. Only the count and the expanded content are
 * rule-kind-specific, which is why both pages share it.
 */
export function FolderListRow({ folderUid, title, kind, count, expanded, onToggle, children }: FolderListRowProps) {
  const styles = useStyles2(getStyles);
  const path = useFolderPath(folderUid);
  // The last segment is the folder itself, already shown as the title.
  const parents = path ? path.slice(0, -1) : [];

  return (
    <li className={styles.wrapper}>
      <div className={styles.header}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.5} flex="1" minWidth={0}>
            <IconButton
              name={expanded ? 'angle-down' : 'angle-right'}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? t('alerting.gma-rule-list.folder-row.collapse', 'Collapse {{title}}', { title })
                  : t('alerting.gma-rule-list.folder-row.expand', 'Expand {{title}}', { title })
              }
              onClick={onToggle}
            />
            <Icon name="folder" />
            <TextLink href={makeFolderRulesLink(folderUid, title)} color="primary" inline={false}>
              {title}
            </TextLink>
            {parents.length > 0 && <FolderPath segments={parents} showIcon={false} />}
          </Stack>
          <FolderCount kind={kind} count={count} title={title} />
        </Stack>
      </div>
      {expanded && (
        <ul role="group" className={styles.group}>
          {children}
        </ul>
      )}
    </li>
  );
}

function FolderCount({ kind, count, title }: { kind: 'alert' | 'recording'; count: FolderRuleCount; title: string }) {
  if (count.status === 'loading') {
    return <Skeleton width={64} />;
  }
  if (count.status === 'error') {
    return (
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.gma-rule-list.folder-row.count-unavailable">Count unavailable</Trans>
        </Text>
        <Button
          size="sm"
          variant="secondary"
          fill="text"
          icon="sync"
          aria-label={t(
            'alerting.gma-rule-list.folder-row.count-retry-label',
            'Retry loading the rule count of {{title}}',
            {
              title,
            }
          )}
          onClick={count.retry}
        >
          <Trans i18nKey="alerting.gma-rule-list.folder-row.count-retry">Retry</Trans>
        </Button>
      </Stack>
    );
  }
  return (
    <Text variant="bodySmall" color="secondary">
      {countLabel(kind, count.count)}
    </Text>
  );
}

function countLabel(kind: 'alert' | 'recording', count: number): string {
  if (kind === 'alert') {
    return t('alerting.gma-rule-list.folder-row.alert-rule-count', '', {
      count,
      defaultValue_one: '{{count}} alert rule',
      defaultValue_other: '{{count}} alert rules',
    });
  }
  return t('alerting.gma-rule-list.folder-row.recording-rule-count', '', {
    count,
    defaultValue_one: '{{count}} recording rule',
    defaultValue_other: '{{count}} recording rules',
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
  }),
  header: css({
    padding: theme.spacing(1, 1.5),

    '&:hover': {
      background: theme.colors.action.hover,
      borderRadius: theme.shape.radius.default,
    },
  }),
  // The guide line sits at the chevron's centre so nested rows read as belonging to the folder.
  group: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    paddingLeft: theme.spacing(4),
    position: 'relative',

    '&:before': {
      content: "''",
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: theme.spacing(2.5),
      borderLeft: `solid 1px ${theme.colors.border.weak}`,
    },
  }),
});
