import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { ContentHeaderSceneWrapper } from '../Header/ContentHeader';
import { DatasourceHelpPanel } from '../Header/DatasourceHelpPanel';
import {
  useActionsContext,
  useDatasourceContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { QueryEditorPanel } from '../QueryEditorRenderer';
import { TransformationEditorPanel } from '../TransformationEditorRenderer';
import { useQueryDatasource } from '../hooks/useQueryDatasource';
import { type Transformation } from '../types';

import { getStackedQueryEditorType } from './utils';

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

  return (
    <>
      <ContentHeaderSceneWrapper
        variant="stacked"
        headingId={headingId}
        target={{ cardType: getStackedQueryEditorType(query), query, dsData: queryDsData, dsLoading: queryDsLoading }}
      />
      {isCurrent && showingDatasourceHelp && <DatasourceHelpPanel />}
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
      <ContentHeaderSceneWrapper
        variant="stacked"
        headingId={headingId}
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
