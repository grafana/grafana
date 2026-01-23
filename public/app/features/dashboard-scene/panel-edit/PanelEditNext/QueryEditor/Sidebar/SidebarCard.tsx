import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Icon, Text, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryRunnerContext } from '../QueryEditorContext';

// TODO: will remove this once we have the correct icons in constants.ts
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

const Header = ({ editorType, className }: { editorType: QueryEditorType; className: string }) => {
  const typeText =
    editorType === 'expression'
      ? t('query-editor-next.sidebar.expression', 'Expression')
      : t('query-editor-next.sidebar.query', 'Query');

  return (
    <div className={className}>
      <CardIcon type={editorType} size={16} />
      <Text weight="light" variant="body">
        {typeText}
      </Text>
    </div>
  );
};

const getEditorType = (type: string | undefined) => (type === '__expr__' ? 'expression' : 'query');

interface SidebarCardProps {
  query: DataQuery;
}

export const SidebarCard = ({ query }: SidebarCardProps) => {
  const editorType = getEditorType(query.datasource?.type);
  const queryDsSettings = useDatasource(query.datasource);
  const { data } = useQueryRunnerContext();

  // Extract error for this specific query
  const queryError =
    data?.error && data.error.refId === query.refId ? data.error : data?.errors?.find((e) => e.refId === query.refId);

  const hasError = Boolean(queryError);
  const styles = useStyles2(getStyles, editorType, hasError);

  return (
    <div className={styles.card} key={query.refId}>
      <Header editorType={editorType} className={styles.cardHeader} />
      <div className={styles.cardContent}>
        <DataSourceLogo dataSource={queryDsSettings} />
        <Text weight="light" variant="body" color="secondary">
          {query.refId}
        </Text>
        {hasError && <Icon name="exclamation-triangle" className={styles.errorIcon} />}
      </div>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2, editorType: QueryEditorType, hasError: boolean) {
  return {
    card: css({
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.secondary,
      border: `1px solid ${hasError ? theme.colors.error.border : theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    cardHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
      color: QUERY_EDITOR_TYPE_CONFIG[editorType].color,
      borderTopRightRadius: theme.shape.radius.default,
      borderTopLeftRadius: theme.shape.radius.default,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
    errorIcon: css({
      marginLeft: 'auto',
      color: theme.colors.error.text,
    }),
  };
}
