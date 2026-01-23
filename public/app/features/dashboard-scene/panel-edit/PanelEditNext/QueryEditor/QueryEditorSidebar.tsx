import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Text, useStyles2 } from '@grafana/ui';
import lokiIconSvg from 'app/plugins/datasource/loki/img/loki_icon.svg';
import mimirLogoSvg from 'app/plugins/datasource/prometheus/img/mimir_logo.svg';
import prometheusLogoSvg from 'app/plugins/datasource/prometheus/img/prometheus_logo.svg';

import { useQueryRunnerContext } from './QueryEditorContext';

const DataSourceIcon = ({ application, size = 16 }: { application: string | undefined; size: number }) => {
  switch (application) {
    case 'prometheus':
      return <img width={size} height={size} src={prometheusLogoSvg} alt="Prometheus" />;
    case 'mimir':
      return <img width={size} height={size} src={mimirLogoSvg} alt="Mimir" />;
    case 'loki':
      return <img width={size} height={size} src={lokiIconSvg} alt="Loki" />;
    case 'grafana':
    default:
      return <Icon name="grafana" />;
  }
};

const CardIcon = ({ type, size = 16 }: { type: string | undefined; size: number }) => {
  switch (type) {
    case 'query':
      return <Icon name="database" />;
    case 'expression':
      return <Icon name="code-branch" />;
    case 'transformation':
      return <Icon name="gf-interpolation-linear" />;
    default:
      return null;
  }
};

export enum SidebarSize {
  Mini = 'mini',
  Full = 'full',
}
interface QueryEditorSidebarProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
}

export const QueryEditorSidebar = memo(function QueryEditorSidebar({
  sidebarSize,
  setSidebarSize,
}: QueryEditorSidebarProps) {
  const styles = useStyles2(getStyles);
  const isMini = sidebarSize === SidebarSize.Mini;

  const { queries, data } = useQueryRunnerContext();

  console.log({ queries, data });

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          icon={isMini ? 'expand-alt' : 'compress-alt'}
          size="sm"
          variant="secondary"
          onClick={toggleSize}
          aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        />
        <Text weight="medium" variant="h6">
          {t('query-editor-next.sidebar.queries', 'Queries')}
        </Text>
      </div>
      <div className={styles.body}>
        {queries.map((query) => (
          <div className={styles.card} key={query.refId}>
            <div className={styles.cardHeader}>
              <CardIcon type={'query'} size={16} />
              <Text weight="light" variant="body">
                {t('query-editor-next.sidebar.query', 'Query')}
              </Text>
            </div>
            <div className={styles.cardContent}>
              <DataSourceIcon application={query.datasource?.type} size={16} />
              <Text color="secondary">{query.refId}</Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      position: 'relative',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
    }),
    header: css({
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    body: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    card: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    cardHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
      color: '#FF8904',
    }),
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
  };
}
