import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { PropsWithChildren, ReactNode } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
          <Stack alignItems="center" gap={0}>
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
    borderRadius: theme.shape.radius.default,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderBottom: 'none',

    marginLeft: theme.spacing(1.5),
  }),
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',

    gap: theme.spacing(1),
  }),
  sectionTitle: css({
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,

    background: theme.colors.background.secondary,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});
