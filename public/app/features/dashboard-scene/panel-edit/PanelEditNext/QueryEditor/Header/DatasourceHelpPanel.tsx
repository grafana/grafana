import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function DatasourceHelpPanel() {
  const { selectedQuery, selectedQueryDsData, selectedQueryDsLoading, toggleDatasourceHelp } =
    useQueryEditorUIContext();
  const { updateSelectedQuery } = useActionsContext();
  const datasource = selectedQueryDsData?.datasource;

  const styles = useStyles2(getStyles);

  if (selectedQueryDsLoading || !datasource?.components?.QueryEditorHelp || !selectedQuery) {
    return null;
  }

  const DatasourceCheatsheet = datasource.components.QueryEditorHelp;

  const onClickExample = (exampleQuery: DataQuery) => {
    // Preserve refId and datasource from current query
    const updatedQuery = {
      ...exampleQuery,
      refId: selectedQuery.refId,
      datasource: exampleQuery.datasource ?? selectedQuery.datasource,
    };
    updateSelectedQuery(updatedQuery, selectedQuery.refId);
    toggleDatasourceHelp();
  };

  return (
    <div className={styles.container}>
      <IconButton
        name="times"
        size="md"
        tooltip={t('query-editor.help.close', 'Close help')}
        onClick={toggleDatasourceHelp}
        className={styles.closeButton}
        aria-label={t('query-editor.help.close-aria', 'Close help panel')}
      />
      <DatasourceCheatsheet query={selectedQuery} datasource={datasource} onClickExample={onClickExample} />
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
