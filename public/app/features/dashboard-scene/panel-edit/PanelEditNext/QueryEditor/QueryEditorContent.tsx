import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorType } from '../constants';
import { GrafanaSqlInlineEditor } from '../../../sql-workbench/GrafanaSqlInlineEditor';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { QueryEditorFooter } from './Footer/QueryEditorFooter';
import { ContentHeaderSceneWrapper } from './Header/ContentHeader';
import { DatasourceHelpPanel } from './Header/DatasourceHelpPanel';
import { useAlertingContext, useQueryEditorUIContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);

  const { cardType, showingDatasourceHelp, pendingExpression, pendingTransformation, grafanaSqlActiveRefId } =
    useQueryEditorUIContext();
  const { alertRules } = useAlertingContext();
  const hasPendingPicker = !!pendingExpression || !!pendingTransformation;
  const isAlertView = cardType === QueryEditorType.Alert;
  const isAlertEmptyState = isAlertView && alertRules.length === 0;
  const isGrafanaSql = grafanaSqlActiveRefId !== null;

  const shouldShowHeader = !isAlertEmptyState;
  const shouldShowFooter = !hasPendingPicker && !isAlertView;
  const shouldShowDatasourceHelp = !hasPendingPicker && showingDatasourceHelp;

  return (
    <div className={styles.container}>
      {shouldShowHeader && <ContentHeaderSceneWrapper />}
      {isGrafanaSql ? (
        <GrafanaSqlInlineEditor onChangeDatasource={() => {}} />
      ) : (
        <>
          {shouldShowDatasourceHelp && <DatasourceHelpPanel />}
          <QueryEditorBody />
          {shouldShowFooter && <QueryEditorFooter />}
        </>
      )}
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
