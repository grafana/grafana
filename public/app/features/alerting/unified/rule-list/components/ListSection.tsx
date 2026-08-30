import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { type PropsWithChildren, type ReactNode } from 'react';
import { useToggle } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { Spacer } from '../../components/Spacer';

interface ListSectionProps extends PropsWithChildren {
  title: ReactNode;
  collapsed?: boolean;
  actions?: ReactNode;
  pagination?: ReactNode;
}

export const ListSection = ({
  children,
  title,
  collapsed = false,
  actions = null,
  pagination = null,
}: ListSectionProps) => {
  const styles = useStyles2(getStyles);
  const [isCollapsed, toggleCollapsed] = useToggle(collapsed);

  return (
    <li className={styles.wrapper} role="treeitem" aria-selected="false">
      <div className={styles.sectionTitle}>
        <Stack alignItems="center">
          <Stack alignItems="center" gap={0.5}>
            <IconButton
              name={isCollapsed ? 'angle-right' : 'angle-down'}
              onClick={toggleCollapsed}
              aria-label={t('common.collapse', 'Collapse')}
            />
            {title}
          </Stack>
          {actions && (
            <>
              <Spacer />
              {actions}
            </>
          )}
        </Stack>
      </div>
      {!isEmpty(children) && !isCollapsed && (
        <>
          <ul role="group" className={styles.groupItemsWrapper}>
            {children}
          </ul>
          {pagination}
        </>
      )}
    </li>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupItemsWrapper: css({
    position: 'relative',

    // Continuous folder guide line — runs alongside every direct child (groups and ungrouped
    // rules), so siblings clearly belong to the same folder regardless of their type.
    '&:before': {
      content: "''",
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: theme.spacing(2.5),
      borderLeft: `solid 1px ${theme.colors.border.weak}`,
    },

    // Direct LI children are ungrouped rules at the folder level. Align their content with
    // the group headers (paddingLeft matches ListGroup headerWrapper) so they read as
    // siblings of the groups, not as nested rule rows.
    '> li[role=treeitem]': {
      listStyle: 'none',
      paddingLeft: theme.spacing(4),
    },

    // LIs nested inside a group (rules inside an expanded ListGroup): keep the deeper
    // indentation and per-row guide line. We can't pass classNames into rendered list
    // items individually, so target them via descendant selector.
    'div[role=treeitem] li[role=treeitem]': {
      listStyle: 'none',
      position: 'relative',
      paddingLeft: theme.spacing(6.5),

      '&:before': {
        content: "''",
        position: 'absolute',
        height: '100%',

        marginLeft: theme.spacing(-1.5),
        marginTop: theme.spacing(-1),
        borderLeft: `solid 1px ${theme.colors.border.weak}`,
      },
    },
  }),
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  sectionTitle: css({
    padding: theme.spacing(1, 1.5),

    '&:hover': {
      background: theme.colors.action.hover,
      borderRadius: theme.shape.radius.default,
    },
  }),
});
