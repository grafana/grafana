import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { ContentHeaderSceneWrapper } from './Header/ContentHeader';
import { DatasourceHelpPanel } from './Header/DatasourceHelpPanel';
import { useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);
  const { queryError } = useQueryRunnerContext();
  const { showingDatasourceHelp } = useQueryEditorUIContext();

  return (
    <div className={styles.container}>
      <ContentHeaderSceneWrapper />
      {showingDatasourceHelp && <DatasourceHelpPanel />}
      <div className={styles.contentBody}>
        {/* TODO: This is a placeholder for the content body. */}
        <Text>
          <Trans i18nKey="dashboard-scene.query-editor-content.content-body-goes-here">Content body goes here!</Trans>
        </Text>
        {queryError && <QueryErrorAlert error={queryError} />}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
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
