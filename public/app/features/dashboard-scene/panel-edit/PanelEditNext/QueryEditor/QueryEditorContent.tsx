import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorType } from '../constants';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { QueryEditorFooter } from './Footer/QueryEditorFooter';
import { ContentHeaderSceneWrapper } from './Header/ContentHeader';
import { DatasourceHelpPanel } from './Header/DatasourceHelpPanel';
import { useQueryEditorUIContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);

  const { cardType } = useQueryEditorUIContext();
  const { queryOptions, showingDatasourceHelp, pendingExpression, pendingTransformation } = useQueryEditorUIContext();
  const { isQueryOptionsOpen } = queryOptions;
  const hasPendingPicker = !!pendingExpression || !!pendingTransformation;
  const isAlertView = cardType === QueryEditorType.Alert;

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
