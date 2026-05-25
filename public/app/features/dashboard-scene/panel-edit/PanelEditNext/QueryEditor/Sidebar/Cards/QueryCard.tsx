import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { Icon, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';
import lokiLogo from 'app/plugins/datasource/loki/img/loki_icon.svg';
import prometheusLogo from 'app/plugins/datasource/prometheus/img/prometheus_logo.svg';
import grafanaIconSvg from 'img/grafana_icon.svg';

import { GRAFANA_SQL_DEFAULT_QUERY } from '../../../../../sql-workbench/GrafanaSqlMode';
import { parseGrafanaSql, type SqlCteSource, type SqlJoinRef } from '../../../../../sql-workbench/grafanaSqlParser';
import { setGrafanaSqlActiveLine, subscribeGrafanaSqlActiveLine } from '../../../../../sql-workbench/workbenchStore';
import { type ActionItem } from '../../../Actions';
import { queryToActionItem } from '../../../actionItem';
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

const DS_LOGOS: Record<string, string> = {
  prometheus: prometheusLogo,
  loki: lokiLogo,
};

const defaultStructure = parseGrafanaSql(GRAFANA_SQL_DEFAULT_QUERY);

function getActiveKey(activeLine: number | null, ctes: SqlCteSource[], joins: SqlJoinRef[]): string | null {
  if (activeLine === null) {
    return null;
  }
  const all = [
    ...ctes.map((c) => ({ key: `cte-${c.name}`, line: c.lineNumber })),
    ...joins.map((j, i) => ({ key: `join-${i}`, line: j.lineNumber })),
  ].sort((a, b) => a.line - b.line);

  let best: string | null = null;
  for (const item of all) {
    if (item.line <= activeLine) {
      best = item.key;
    }
  }
  return best;
}

function GrafanaSqlCardSchematic() {
  const styles = useStyles2(getSchematicStyles);
  const [activeLine, setActiveLine] = useState<number | null>(null);

  useEffect(() => {
    return subscribeGrafanaSqlActiveLine(setActiveLine);
  }, []);

  const activeKey = getActiveKey(activeLine, defaultStructure.ctes, defaultStructure.joins);

  return (
    <div className={styles.schematic}>
      {defaultStructure.ctes.map((cte, i) => {
        const logo = DS_LOGOS[cte.datasourceType.toLowerCase()];
        const isActive = activeKey === `cte-${cte.name}`;
        return (
          <button
            key={cte.name}
            className={cx(styles.row, { [styles.rowActive]: isActive })}
            onClick={(e) => {
              e.stopPropagation();
              setGrafanaSqlActiveLine(cte.lineNumber);
            }}
          >
            <span className={styles.iconWrap}>
              {logo ? (
                <img src={logo} alt={cte.datasourceType} className={styles.dsLogo} />
              ) : (
                <Icon name="database" size="xs" />
              )}
            </span>
            <span className={cx(i === 0 ? styles.cteBold : styles.cteLight, { [styles.textActive]: isActive })}>
              {cte.name}
            </span>
          </button>
        );
      })}
      {defaultStructure.joins.map((join, i) => {
        const isActive = activeKey === `join-${i}`;
        return (
          <button
            key={i}
            className={cx(styles.row, { [styles.rowActive]: isActive })}
            onClick={(e) => {
              e.stopPropagation();
              setGrafanaSqlActiveLine(join.lineNumber);
            }}
          >
            <span className={styles.iconWrap}>
              <Icon name="code-branch" size="xs" />
            </span>
            <span className={cx(styles.cteLight, { [styles.textActive]: isActive })}>join</span>
          </button>
        );
      })}
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
      paddingLeft: 20,
    }),
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      '&:hover span': {
        color: theme.colors.primary.text,
      },
    }),
    rowActive: css({}),
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
    textActive: css({
      color: `${theme.colors.primary.text} !important`,
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

  const item = queryToActionItem(query, { error });

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
              <img src={grafanaIconSvg} alt="Grafana SQL" className={styles.grafanaIcon} />
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
    grafanaIcon: css({
      width: 14,
      height: 14,
      objectFit: 'contain',
      flexShrink: 0,
    }),
  };
}
