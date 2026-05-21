import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { Icon, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { GRAFANA_SQL_DEFAULT_QUERY } from '../../../../../sql-workbench/GrafanaSqlMode';
import { parseGrafanaSql } from '../../../../../sql-workbench/grafanaSqlParser';
import { type ActionItem } from '../../../Actions';
import { PENDING_CARD_ID, QueryEditorType } from '../../../constants';
import {
  useActionsContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
  useQueryEditorTypeConfig,
} from '../../QueryEditorContext';
import { getEditorType } from '../../utils';

import { CardTitle } from './CardTitle';
import { GhostSidebarCard } from './GhostSidebarCard';
import { SidebarCard } from './SidebarCard';

import lokiLogo from 'app/plugins/datasource/loki/img/loki_icon.svg';
import prometheusLogo from 'app/plugins/datasource/prometheus/img/prometheus_logo.svg';

const DS_LOGOS: Record<string, string> = {
  prometheus: prometheusLogo,
  loki: lokiLogo,
};

const defaultStructure = parseGrafanaSql(GRAFANA_SQL_DEFAULT_QUERY);

function GrafanaSqlCardSchematic() {
  const styles = useStyles2(getSchematicStyles);

  return (
    <div className={styles.schematic}>
      {defaultStructure.ctes.map((cte, i) => {
        const logo = DS_LOGOS[cte.datasourceType.toLowerCase()];
        return (
          <div key={cte.name} className={styles.row}>
            <span className={styles.iconWrap}>
              {logo ? (
                <img src={logo} alt={cte.datasourceType} className={styles.dsLogo} />
              ) : (
                <Icon name="database" size="xs" />
              )}
            </span>
            <span className={i === 0 ? styles.cteBold : styles.cteLight}>{cte.name}</span>
          </div>
        );
      })}
      {defaultStructure.joins.map((_, i) => (
        <div key={i} className={styles.row}>
          <span className={styles.iconWrap}>
            <Icon name="code-branch" size="xs" />
          </span>
          <span className={styles.cteLight}>join</span>
        </div>
      ))}
    </div>
  );
}

function getSchematicStyles(theme: GrafanaTheme2) {
  return {
    schematic: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      paddingTop: theme.spacing(0.5),
    }),
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    iconWrap: css({
      width: 14,
      height: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }),
    dsLogo: css({
      width: 14,
      height: 14,
      objectFit: 'contain',
    }),
    cteBold: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: 11,
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.primary,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    cteLight: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: 11,
      fontWeight: theme.typography.fontWeightLight,
      color: theme.colors.text.primary,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
  };
}

export const QueryCard = ({ query }: { query: DataQuery }) => {
  const editorType = getEditorType(query);
  const queryDsSettings = useDatasource(query.datasource);
  const { selectedQuery, toggleQuerySelection, selectedQueryRefIds, pendingExpression, pendingSavedQuery } =
    useQueryEditorUIContext();
  const { duplicateQuery, deleteQuery, toggleQueryHide } = useActionsContext();
  const { data } = useQueryRunnerContext();
  const typeConfig = useQueryEditorTypeConfig();
  const styles = useStyles2(getCardStyles);

  const { grafanaSqlActiveRefId } = useQueryEditorUIContext();
  const isGrafanaSql = editorType === QueryEditorType.Query && grafanaSqlActiveRefId === query.refId;

  const error = data?.errors?.find((e) => e.refId === query.refId)?.message;
  const isSelected = selectedQuery?.refId === query.refId;
  const isPartOfSelection = selectedQueryRefIds.includes(query.refId) && !isSelected;
  const isHidden = !!query.hide;

  const item: ActionItem = {
    name: query.refId,
    type: editorType,
    isHidden,
    error,
  };

  return (
    <>
      <SidebarCard
        id={query.refId}
        isSelected={isSelected}
        isPartOfSelection={isPartOfSelection}
        item={item}
        onSelect={(modifiers) => toggleQuerySelection(query, modifiers)}
        onDelete={() => deleteQuery(query.refId)}
        onDuplicate={() => duplicateQuery(query.refId)}
        onToggleHide={() => toggleQueryHide(query.refId)}
      >
        {isGrafanaSql ? (
          <div className={styles.grafanaSqlContent}>
            <div className={styles.headerRow}>
              <DataSourceLogo dataSource={queryDsSettings} size={14} />
              <CardTitle title={query.refId} isHidden={isHidden} />
            </div>
            <GrafanaSqlCardSchematic />
          </div>
        ) : editorType === QueryEditorType.Query ? (
          <DataSourceLogo dataSource={queryDsSettings} size={14} />
        ) : (
          <Icon name={typeConfig[editorType].icon} color={typeConfig[editorType].color} size="sm" />
        )}
        {!isGrafanaSql && <CardTitle title={query.refId} isHidden={isHidden} />}
      </SidebarCard>
      {pendingExpression?.insertAfter === query.refId && (
        <GhostSidebarCard id={PENDING_CARD_ID.expression} type={QueryEditorType.Expression} />
      )}
      {pendingSavedQuery?.insertAfter === query.refId && (
        <GhostSidebarCard id={PENDING_CARD_ID.savedQuery} type={QueryEditorType.Query} />
      )}
    </>
  );
};

function getCardStyles(theme: GrafanaTheme2) {
  return {
    grafanaSqlContent: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minWidth: 0,
      padding: theme.spacing(0.5, 0),
    }),
    headerRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
  };
}
