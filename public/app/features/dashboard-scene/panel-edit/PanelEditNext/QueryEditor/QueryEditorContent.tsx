import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { QueryEditorFooter } from './Footer/QueryEditorFooter';
import { ContentHeaderSceneWrapper } from './Header/ContentHeader';
import { DatasourceHelpPanel } from './Header/DatasourceHelpPanel';
import { useQueryEditorUIContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);

  const { activeContext, queryOptions, showingDatasourceHelp } = useQueryEditorUIContext();
  const { isQueryOptionsOpen } = queryOptions;
  const hasPendingPicker =
    activeContext.view === 'data' &&
    (activeContext.selection.kind === 'expressionPicker' || activeContext.selection.kind === 'transformationPicker');
  const isAlertView = activeContext.view === 'alerts';

  const shouldShowFooter = !hasPendingPicker && !isQueryOptionsOpen && !isAlertView;
  const shouldShowDatasourceHelp = !hasPendingPicker && showingDatasourceHelp;

  return (
    <div className={styles.container}>
      <ContentHeaderSceneWrapper />
      {shouldShowDatasourceHelp && <DatasourceHelpPanel />}
      <QueryEditorBody />
      {shouldShowFooter && <QueryEditorFooter />}
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
    overflow: 'hidden',
  }),
});
