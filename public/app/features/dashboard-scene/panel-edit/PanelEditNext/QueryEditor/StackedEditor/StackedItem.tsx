import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Icon, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';

import { QueryEditorType } from '../../constants';
import { EditableQueryName } from '../Header/EditableQueryName';
import {
  useActionsContext,
  useDatasourceContext,
  usePanelContext,
  useQueryEditorTypeConfig,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { QueryEditorPanel } from '../QueryEditorRenderer';
import { TransformationEditorPanel } from '../TransformationEditorRenderer';
import { useQueryDatasource } from '../hooks/useQueryDatasource';
import { type Transformation } from '../types';

import { getStackedQueryEditorType } from './utils';

interface StackedItemHeaderProps {
  /** Rendered as the leading icon — typically a datasource logo or type icon. */
  icon: ReactNode;
  /** The middle label (e.g. datasource name or "Transformation"). Omitted if undefined. */
  label?: ReactNode;
  /** The trailing identifier (query refId or transformation name). */
  identifier: ReactNode;
  /** ID used by the section's aria-labelledby so screen readers announce this header. */
  headingId: string;
  /** When true, the identifier is struck through and a trailing eye-slash icon is shown. */
  isHidden?: boolean;
}

function StackedItemHeader({ icon, label, identifier, headingId, isHidden = false }: StackedItemHeaderProps) {
  const styles = useStyles2(getStyles);

  return (
    <div id={headingId} className={styles.itemHeader}>
      <span className={styles.headerIcon}>{icon}</span>
      {label !== undefined && (
        <>
          <span className={styles.headerLabel}>{label}</span>
          <span className={styles.headerSeparator} />
        </>
      )}
      <span className={styles.headerRefId}>{identifier}</span>
      {isHidden && (
        <Icon
          name="eye-slash"
          size="sm"
          className={styles.headerHiddenIcon}
          aria-label={t('query-editor-next.stacked.hidden-aria-label', 'Hidden')}
        />
      )}
    </div>
  );
}

interface StackedQueryItemProps {
  query: DataQuery;
  headingId: string;
}

export function StackedQueryItem({ query, headingId }: StackedQueryItemProps) {
  const styles = useStyles2(getStyles);

  const typeConfig = useQueryEditorTypeConfig();
  const { dsSettings } = useDatasourceContext();
  const { panel } = usePanelContext();
  const { queries, data } = useQueryRunnerContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();
  const { queryDsData, queryDsLoading } = useQueryDatasource(query, dsSettings, panel);

  const editorType = getStackedQueryEditorType(query);
  const isExpression = editorType === QueryEditorType.Expression;

  const icon = isExpression ? (
    <Icon name={typeConfig[editorType].icon} size="md" color={typeConfig[editorType].color} />
  ) : (
    <DataSourceLogo dataSource={queryDsData?.dsSettings} size={18} />
  );

  const label = isExpression ? typeConfig[editorType].getLabel() : queryDsData?.dsSettings.name;

  return (
    <>
      <StackedItemHeader
        icon={icon}
        label={label}
        identifier={
          <EditableQueryName key={query.refId} query={query} queries={queries} onQueryUpdate={updateSelectedQuery} />
        }
        headingId={headingId}
        isHidden={Boolean(query.hide)}
      />
      <div className={styles.itemBody}>
        <QueryEditorPanel
          query={query}
          queryDsData={queryDsData}
          queryDsLoading={queryDsLoading}
          queries={queries}
          data={data}
          updateQuery={updateSelectedQuery}
          addQuery={addQuery}
          runQueries={runQueries}
        />
      </div>
    </>
  );
}

interface StackedTransformationItemProps {
  transformation: Transformation;
  headingId: string;
}

export function StackedTransformationItem({ transformation, headingId }: StackedTransformationItemProps) {
  const styles = useStyles2(getStyles);
  const typeConfig = useQueryEditorTypeConfig();
  const { transformations } = usePanelContext();
  const { data } = useQueryRunnerContext();
  const { updateTransformation } = useActionsContext();
  const transformationName = transformation.registryItem?.name || transformation.transformConfig.id;
  const icon = (
    <Icon
      name={typeConfig[QueryEditorType.Transformation].icon}
      size="md"
      color={typeConfig[QueryEditorType.Transformation].color}
    />
  );

  return (
    <>
      <StackedItemHeader
        icon={icon}
        label={<Trans i18nKey="query-editor-next.stacked.transformation">Transformation</Trans>}
        identifier={transformationName}
        headingId={headingId}
        isHidden={Boolean(transformation.transformConfig.disabled)}
      />
      <div className={styles.itemBody}>
        <TransformationEditorPanel
          transformation={transformation}
          transformations={transformations}
          data={data}
          updateTransformation={updateTransformation}
        />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  itemHeader: css({
    minHeight: theme.spacing(5),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(0.5, 2),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  headerIcon: css({
    alignItems: 'center',
    display: 'inline-flex',
    flex: '0 0 auto',
    justifyContent: 'center',
    width: theme.spacing(2.25),
  }),
  headerLabel: css({
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  headerRefId: css({
    ...theme.typography.code,
  }),
  headerHiddenIcon: css({
    marginLeft: 'auto',
  }),
  itemBody: css({
    padding: theme.spacing(2),
  }),
  headerSeparator: css({
    width: 1,
    height: theme.spacing(3),
    background: theme.colors.border.medium,
  }),
});
