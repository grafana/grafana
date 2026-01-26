import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Icon, IconSize, Text, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryRunnerContext } from '../QueryEditorContext';

// TODO: will remove this once we have the correct icons in constants.ts
const CardIcon = ({ type, size = 'sm' }: { type: string | undefined; size?: IconSize }) => {
  switch (type) {
    case 'query':
      return <Icon name="database" size={size} />;
    case 'expression':
      return <Icon name="code-branch" size={size} />;
    case 'transformation':
      return <Icon name="gf-interpolation-linear" size={size} />;
    default:
      return null;
  }
};

const Header = ({ editorType, hasError }: { editorType: QueryEditorType; hasError: boolean }) => {
  const styles = useStyles2(getStyles, editorType, hasError);
  const typeText =
    editorType === 'expression'
      ? t('query-editor-next.sidebar.expression', 'Expression')
      : t('query-editor-next.sidebar.query', 'Query');

  return (
    <div className={styles.cardHeader}>
      <div className={styles.cardHeaderContent}>
        <CardIcon type={editorType} />
        <Text weight="light" variant="body">
          {typeText}
        </Text>
      </div>
      <Icon name="circle-mono" className={styles.errorIcon} />
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

  // Extract error for this specific query by matching refId
  const queryError = data?.errors?.find((e) => e.refId === query.refId);

  const hasError = Boolean(queryError);
  const styles = useStyles2(getStyles, editorType, hasError);

  const handleClick = () => {
    // TODO: Implement click action (e.g., select/focus this query)
    console.log('Card clicked:', query.refId);
  };

  return (
    <button
      className={styles.card}
      key={query.refId}
      onClick={handleClick}
      type="button"
      aria-label={t('query-editor-next.sidebar.card-click', 'Select query {{refId}}', { refId: query.refId })}
    >
      <Header editorType={editorType} hasError={hasError} />
      <div className={styles.cardContent}>
        <DataSourceLogo dataSource={queryDsSettings} />
        <Text weight="light" variant="body" color="secondary">
          {query.refId}
        </Text>
      </div>
    </button>
  );
};

function getStyles(theme: GrafanaTheme2, editorType: QueryEditorType, hasError: boolean) {
  return {
    card: css({
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      padding: 0,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        borderColor: theme.colors.border.medium,
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
    cardHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
      color: QUERY_EDITOR_TYPE_CONFIG[editorType].color,
      borderTopRightRadius: theme.shape.radius.default,
      borderTopLeftRadius: theme.shape.radius.default,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    cardHeaderContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
    errorIcon: css({
      color: hasError ? theme.colors.error.text : theme.colors.success.text,
      width: '6px',
      height: '6px',
      marginRight: theme.spacing(0.5),
    }),
  };
}
