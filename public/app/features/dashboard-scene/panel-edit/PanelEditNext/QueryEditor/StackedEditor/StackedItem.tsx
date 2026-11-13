import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { QueryEditorType } from '../../constants';
import { ContentHeaderSceneWrapper } from '../Header/ContentHeader';
import { DatasourceHelpPanel } from '../Header/DatasourceHelpPanel';
import {
  type StackedEditorItem,
  useActionsContext,
  useDatasourceContext,
  usePanelContext,
  useQueryEditorTypeConfig,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { QueryEditorPanel } from '../QueryEditorRenderer';
import { TransformationEditorPanel } from '../TransformationEditorRenderer';
import { useQueryDatasource } from '../hooks/useQueryDatasource';
import { type Transformation } from '../types';
import { getExpressionSectionLabel } from '../utils';

import { getStackedQueryEditorType } from './utils';

interface StackedItemHeadingProps {
  id: string;
  type: StackedEditorItem['type'];
  name: string;
  detail?: string;
}

/**
 * Names the section for assistive tech. The visible header is made of controls whose labels describe
 * actions ("Select a data source", "Edit query name"), so it would name every section the same.
 */
function StackedItemHeading({ id, type, name, detail }: StackedItemHeadingProps) {
  const typeConfig = useQueryEditorTypeConfig();
  const values = { type: typeConfig[type].getLabel(), name, detail, interpolation: { escapeValue: false } };

  return (
    <span id={id} className="sr-only">
      {detail
        ? t('query-editor-next.stacked.heading-with-detail', '{{type}} {{name}}, {{detail}}', values)
        : t('query-editor-next.stacked.heading', '{{type}} {{name}}', values)}
    </span>
  );
}

interface StackedQueryItemProps {
  query: DataQuery;
  headingId: string;
  isCurrent: boolean;
}

export function StackedQueryItem({ query, headingId, isCurrent }: StackedQueryItemProps) {
  const styles = useStyles2(getStyles);

  const { dsSettings } = useDatasourceContext();
  const { panel } = usePanelContext();
  const { queries, data } = useQueryRunnerContext();
  const { showingDatasourceHelp } = useQueryEditorUIContext();
  const { updateSelectedQuery, addQuery, runQueries, startQueryPreview } = useActionsContext();
  const { queryDsData, queryDsLoading } = useQueryDatasource(query, dsSettings, panel);
  const editorType = getStackedQueryEditorType(query);
  const target = { cardType: editorType, query, dsData: queryDsData, dsLoading: queryDsLoading };

  return (
    <>
      <StackedItemHeading
        id={headingId}
        type={editorType}
        name={query.refId}
        detail={isExpressionQuery(query) ? getExpressionSectionLabel(query) : queryDsData?.dsSettings?.name}
      />
      <ContentHeaderSceneWrapper variant="stacked" target={target} />
      {isCurrent && showingDatasourceHelp && <DatasourceHelpPanel target={target} />}
      <div className={styles.itemBody}>
        <QueryEditorPanel
          panel={panel}
          query={query}
          queryDsData={queryDsData}
          queryDsLoading={queryDsLoading}
          queries={queries}
          data={data}
          updateQuery={updateSelectedQuery}
          addQuery={addQuery}
          runQueries={runQueries}
          startQueryPreview={startQueryPreview}
        />
      </div>
    </>
  );
}

interface StackedTransformationItemProps {
  transformation: Transformation;
  headingId: string;
  isCurrent: boolean;
}

export function StackedTransformationItem({ transformation, headingId, isCurrent }: StackedTransformationItemProps) {
  const styles = useStyles2(getStyles);
  const { transformations } = usePanelContext();
  const { data } = useQueryRunnerContext();
  const { updateTransformation } = useActionsContext();

  return (
    <>
      <StackedItemHeading
        id={headingId}
        type={QueryEditorType.Transformation}
        name={transformation.registryItem?.name || transformation.transformConfig.id}
      />
      <ContentHeaderSceneWrapper
        variant="stacked"
        target={{ cardType: QueryEditorType.Transformation, transformation }}
      />
      <div className={styles.itemBody}>
        <TransformationEditorPanel
          transformation={transformation}
          transformations={transformations}
          data={data}
          updateTransformation={updateTransformation}
          showSupplementalDisplays={isCurrent}
        />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  itemBody: css({
    padding: theme.spacing(2),
  }),
});
