import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

import { type QueryActionTarget } from './headerActionTarget';

interface DatasourceHelpPanelProps {
  /** The query to show help for. Defaults to the selected query and its data source. */
  target?: Pick<QueryActionTarget, 'query' | 'dsData' | 'dsLoading'>;
}

export function DatasourceHelpPanel({ target }: DatasourceHelpPanelProps = {}) {
  const { selectedQuery, selectedQueryDsData, selectedQueryDsLoading, toggleDatasourceHelp } =
    useQueryEditorUIContext();
  const { updateSelectedQuery } = useActionsContext();
  const query = target ? target.query : selectedQuery;
  const datasource = target ? target.dsData?.datasource : selectedQueryDsData?.datasource;
  const dsLoading = target ? target.dsLoading : selectedQueryDsLoading;

  const styles = useStyles2(getStyles);

  if (dsLoading || !datasource?.components?.QueryEditorHelp || !query) {
    return null;
  }

  const DatasourceCheatsheet = datasource.components.QueryEditorHelp;

  const onClickExample = (exampleQuery: DataQuery) => {
    // Preserve refId and datasource from current query
    const updatedQuery = {
      ...exampleQuery,
      refId: query.refId,
      datasource: exampleQuery.datasource ?? query.datasource,
    };
    updateSelectedQuery(updatedQuery, query.refId);
    toggleDatasourceHelp();
  };

  return (
    <div className={styles.container}>
      <IconButton
        name="times"
        size="md"
        tooltip={t('query-editor-next.help.close', 'Close help')}
        onClick={toggleDatasourceHelp}
        className={styles.closeButton}
        aria-label={t('query-editor-next.help.close-aria', 'Close help panel')}
      />
      <DatasourceCheatsheet query={query} datasource={datasource} onClickExample={onClickExample} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.primary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    maxHeight: '400px',
    overflowY: 'auto',
  }),
  closeButton: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 1,
  }),
});
