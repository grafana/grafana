import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Icon, IconButton, Stack, TextLink, useStyles2 } from '@grafana/ui';

import { makeFolderAlertsLink } from '../../utils/misc';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleRowList } from '../rule-row/RuleRowList';

interface FolderListRowProps {
  folderUid: string;
  title: string;
  /** Ancestor titles, outermost first; excludes the folder itself, which the title already shows. */
  parents: string[];
  /** Slot for the rule count shown at the end of the row. */
  count: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function FolderListRow({ folderUid, title, parents, count, expanded, onToggle, children }: FolderListRowProps) {
  const styles = useStyles2(getStyles);

  return (
    <li>
      <div className={styles.header}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.5} flex="1" minWidth={0}>
            <IconButton
              name={expanded ? 'angle-down' : 'angle-right'}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? t('alerting.gma-rule-list.folder-row.collapse', 'Collapse {{title}}', {
                      interpolation: { escapeValue: false },
                      title,
                    })
                  : t('alerting.gma-rule-list.folder-row.expand', 'Expand {{title}}', {
                      interpolation: { escapeValue: false },
                      title,
                    })
              }
              onClick={onToggle}
            />
            <Icon name="folder" />
            <TextLink href={makeFolderAlertsLink(folderUid, title)} color="primary" inline={false}>
              {title}
            </TextLink>
            {parents.length > 0 && <FolderPath segments={parents} showIcon={false} />}
          </Stack>
          {count}
        </Stack>
      </div>
      {expanded && (
        <Box paddingLeft={4}>
          <RuleRowList>{children}</RuleRowList>
        </Box>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Not action.hover: it drops secondary text below 4.5:1 contrast in the dark theme.
  header: css({
    padding: theme.spacing(1, 1.5),

    '&:hover': {
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    },
  }),
});
