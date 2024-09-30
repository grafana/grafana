import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { PropsWithChildren, ReactNode } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { PromApplication } from '@grafana/prometheus/src/types';
import { Icon, IconButton, Stack, TextLink, useStyles2 } from '@grafana/ui';

import { Spacer } from '../../Spacer';

interface NamespaceProps extends PropsWithChildren {
  name: ReactNode;
  href?: string;
  application?: PromApplication | 'Grafana';
  collapsed?: boolean;
  actions?: ReactNode;
  pagination?: ReactNode;
}

export const Namespace = ({
  children,
  name,
  href,
  application,
  collapsed = false,
  actions = null,
  pagination = null,
}: NamespaceProps) => {
  const styles = useStyles2(getStyles);
  const [isCollapsed, toggleCollapsed] = useToggle(collapsed);

  const genericApplicationIcon = application === 'Grafana';

  return (
    <li className={styles.namespaceWrapper} role="treeitem" aria-selected="false">
      <div className={styles.namespaceTitle}>
        <Stack alignItems={'center'}>
          <Stack alignItems={'center'} gap={1}>
            <IconButton
              name={isCollapsed ? 'angle-right' : 'angle-down'}
              onClick={toggleCollapsed}
              aria-label="collapse namespace"
            />
            {application === PromApplication.Prometheus && (
              <img
                width={16}
                height={16}
                src="/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg"
                alt="Prometheus"
              />
            )}
            {application === PromApplication.Mimir && (
              <img
                width={16}
                height={16}
                src="/public/app/plugins/datasource/prometheus/img/mimir_logo.svg"
                alt="Mimir"
              />
            )}
            {genericApplicationIcon && <Icon name="folder" />}
            {href && typeof name === 'string' ? (
              <TextLink href={href} inline={false}>
                {name}
              </TextLink>
            ) : (
              name
            )}
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

    marginLeft: theme.spacing(3),

    '&:before': {
      content: "''",
      position: 'absolute',
      height: '100%',

      borderLeft: `solid 1px ${theme.colors.border.weak}`,

      marginTop: 0,
      marginLeft: `-${theme.spacing(2.5)}`,
    },
  }),
  namespaceWrapper: css({
    display: 'flex',
    flexDirection: 'column',

    gap: theme.spacing(1),
  }),
  namespaceTitle: css({
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,

    background: theme.colors.background.secondary,

    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});
