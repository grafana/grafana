import { css } from '@emotion/css';
import { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { PromApplication, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { WithReturnButton } from '../../components/WithReturnButton';

interface NamespaceProps extends PropsWithChildren {
  name: string;
  href?: string;
  application?: RulesSourceApplication;
}

// @TODO add export rules for namespace back in
const Namespace = ({ children, name, href, application }: NamespaceProps) => {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.namespaceWrapper} role="treeitem" aria-selected="false">
      <div className={styles.namespaceTitle}>
        <Stack alignItems={'center'} gap={1}>
          <DataSourceIcon application={application} />
          {href ? (
            <WithReturnButton
              title={t('alerting.namespace.title-alert-rules', 'Alert rules')}
              component={
                <TextLink href={href} inline={false}>
                  {name}
                </TextLink>
              }
            />
          ) : (
            name
          )}
        </Stack>
      </div>
      {children && (
        <ul role="group" className={styles.groupItemsWrapper}>
          {children}
        </ul>
      )}
    </li>
  );
};

interface NamespaceIconProps {
  application?: RulesSourceApplication;
  size?: number;
}

export const DataSourceIcon = ({ application, size = 16 }: NamespaceIconProps) => {
  switch (application) {
    case PromApplication.Prometheus:
      return (
        <img
          width={size}
          height={size}
          src="public/app/plugins/datasource/prometheus/img/prometheus_logo.svg"
          alt="Prometheus"
        />
      );
    case PromApplication.Mimir:
      return (
        <img width={size} height={size} src="public/app/plugins/datasource/prometheus/img/mimir_logo.svg" alt="Mimir" />
      );
    case 'Loki':
      return <img width={size} height={size} src="public/app/plugins/datasource/loki/img/loki_icon.svg" alt="Loki" />;
    case 'grafana':
    default:
      return <Icon name="grafana" />;
  }
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
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    // background: theme.colors.background.secondary,

    // border: `solid 1px ${theme.colors.border.weak}`,
    // borderRadius: theme.shape.radius.default,
  }),
});

export default Namespace;
