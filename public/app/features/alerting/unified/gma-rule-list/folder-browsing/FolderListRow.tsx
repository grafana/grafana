import { css } from '@emotion/css';
import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';

import { makeFolderAlertsLink } from '../../utils/misc';
import { FolderPath } from '../rule-row/FolderPath';
import { type RuleKind } from '../shared/ruleKind';

import { type FolderRuleCount, useFolderPath } from './folderLookups';

interface FolderListRowProps {
  folderUid: string;
  title: string;
  kind: RuleKind;
  /** Direct count for this rule kind only, never descendants. */
  count: FolderRuleCount;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

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
            <TextLink href={makeFolderAlertsLink(folderUid, title)} color="primary" inline={false}>
              {title}
            </TextLink>
            {parents.length > 0 && <FolderPath segments={parents} showIcon={false} />}
          </Stack>
          <FolderCount kind={kind} count={count} title={title} />
        </Stack>
      </div>
      {expanded && <ul className={styles.group}>{children}</ul>}
    </li>
  );
}

function FolderCount({ kind, count, title }: { kind: RuleKind; count: FolderRuleCount; title: string }) {
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
    <Tooltip
      content={t(
        'alerting.gma-rule-list.folder-row.count-tooltip',
        'Rules directly in this folder. Subfolders are listed separately.'
      )}
    >
      <span>
        <Text variant="bodySmall" color="secondary">
          {countLabel(kind, count.count)}
        </Text>
      </span>
    </Tooltip>
  );
}

function countLabel(kind: RuleKind, count: number): string {
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

    // Not action.hover: it drops secondary text below 4.5:1 contrast in the dark theme.
    '&:hover': {
      background: theme.colors.background.secondary,
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
