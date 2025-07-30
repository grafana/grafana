import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { PropsWithChildren, ReactNode } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
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

    // unfortunately we have to resort to this since we can't overwrite the styles of the list items individually
    // unless we clone the React Elements and modify className
    'li[role=treeitem]': {
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
    },
  }),
});
