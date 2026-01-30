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
  onToggle?: () => void;
}

export const ListSection = ({
  children,
  title,
  collapsed = false,
  actions = null,
  pagination = null,
  onToggle,
}: ListSectionProps) => {
  const styles = useStyles2(getStyles);
  const [internalCollapsed, internalToggle] = useToggle(collapsed);

  // Use external toggle if provided, otherwise use internal
  const isCollapsed = onToggle ? collapsed : internalCollapsed;
  const toggle = onToggle ?? internalToggle;

  return (
    <li className={styles.wrapper} role="treeitem" aria-selected="false">
      <div className={styles.sectionTitle}>
        <Stack alignItems="center">
          <Stack alignItems="center" gap={0.5}>
            <IconButton
              name={isCollapsed ? 'angle-right' : 'angle-down'}
              onClick={toggle}
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    groupItemsWrapper: css({
      position: 'relative',
      paddingLeft: theme.spacing(2), // Add padding for nested children

      // Direct children (groups or nested folders)
      '& > li[role=treeitem]': {
        listStyle: 'none',
        position: 'relative',

        '&:before': {
          content: "''",
          position: 'absolute',
          height: '100%',
          left: theme.spacing(-1.5),
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
  };
};
