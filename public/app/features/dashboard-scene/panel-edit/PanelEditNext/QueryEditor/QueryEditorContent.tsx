import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { QueryEditorFooter } from './Footer/QueryEditorFooter';
import { ContentHeaderSceneWrapper } from './Header/ContentHeader';
import { DatasourceHelpPanel } from './Header/DatasourceHelpPanel';
import { useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);
  const { queryError } = useQueryRunnerContext();
  const { queryOptions, showingDatasourceHelp } = useQueryEditorUIContext();
  const { isQueryOptionsOpen } = queryOptions;

  return (
    <div className={styles.container}>
      <ContentHeaderSceneWrapper />
      {showingDatasourceHelp && <DatasourceHelpPanel />}
      <QueryEditorBody>{queryError && <QueryErrorAlert error={queryError} />}</QueryEditorBody>
      {!isQueryOptionsOpen && <QueryEditorFooter />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    height: '100%',
    width: '100%',
  }),
  contentBody: css({
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
});
