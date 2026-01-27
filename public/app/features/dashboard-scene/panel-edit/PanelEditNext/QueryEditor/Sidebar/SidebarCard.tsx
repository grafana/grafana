import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryRunnerContext, useQueryEditorUIContext } from '../QueryEditorContext';

const Header = ({ editorType, styles }: { editorType: QueryEditorType; styles: ReturnType<typeof getStyles> }) => {
  const typeText =
    editorType === 'expression'
      ? t('query-editor-next.sidebar.expression', 'Expression')
      : t('query-editor-next.sidebar.query', 'Query');

  return (
    <div className={styles.cardHeader}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[editorType].icon} />
        <Text weight="light" variant="body">
          {typeText}
        </Text>
      </Stack>
      <Icon name="circle-mono" className={styles.dsStatusIcon} />
    </div>
  );
};

const getEditorType = (query: DataQuery): QueryEditorType =>
  isExpressionQuery(query) ? QueryEditorType.Expression : QueryEditorType.Query;

interface SidebarCardProps {
  query: DataQuery;
}

export const SidebarCard = ({ query }: SidebarCardProps) => {
  const editorType = getEditorType(query);
  const queryDsSettings = useDatasource(query.datasource);
  const { data } = useQueryRunnerContext();
  const { selectedCard, setSelectedCard } = useQueryEditorUIContext();

  const hasError = data?.errors?.some((e) => e.refId === query.refId) ?? false;
  const isSelected = selectedCard?.refId === query.refId;
  const styles = useStyles2(getStyles, editorType, hasError, isSelected);

  const handleClick = () => {
    // We don't allow deselecting cards so don't do anything if already selected
    if (!isSelected) {
      setSelectedCard(query);
    }
  };

  return (
    <button
      className={styles.card}
      onClick={handleClick}
      type="button"
      aria-label={t('query-editor-next.sidebar.card-click', 'Select query {{refId}}', { refId: query.refId })}
      aria-pressed={isSelected}
    >
      <Header editorType={editorType} styles={styles} />
      <div className={styles.cardContent}>
        <DataSourceLogo dataSource={queryDsSettings} />
        <Text weight="light" variant="body" color="secondary">
          {query.refId}
        </Text>
      </div>
    </button>
  );
};

function getStyles(theme: GrafanaTheme2, editorType: QueryEditorType, hasError: boolean, isSelected?: boolean) {
  return {
    card: css({
      display: 'flex',
      flexDirection: 'column',
      background: isSelected ? theme.colors.action.selected : theme.colors.background.secondary,
      border: `1px solid ${isSelected ? theme.colors.primary.border : theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      padding: 0,
      boxShadow: isSelected ? `0 0 9px 0 rgba(58, 139, 255, 0.3)` : 'none',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: isSelected
          ? theme.colors.action.selected
          : theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        borderColor: isSelected ? theme.colors.primary.border : theme.colors.border.medium,
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
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
    dsStatusIcon: css({
      color: hasError ? theme.colors.error.text : theme.colors.success.text,
      width: '6px',
      height: '6px',
      marginRight: theme.spacing(0.5),
    }),
  };
}
