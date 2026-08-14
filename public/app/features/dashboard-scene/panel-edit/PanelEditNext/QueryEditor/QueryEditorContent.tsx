import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorType } from '../constants';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { QueryEditorFooter } from './Footer/QueryEditorFooter';
import { ContentHeaderSceneWrapper } from './Header/ContentHeader';
import { DatasourceHelpPanel } from './Header/DatasourceHelpPanel';
import { QueriesEmptyState } from './QueriesEmptyState';
import {
  useAlertingContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { StackedEditorRenderer } from './StackedEditor/StackedEditorRenderer';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);

  const { cardType, showingDatasourceHelp, pendingExpression, pendingTransformation, pendingSavedQuery, stackedMode } =
    useQueryEditorUIContext();
  const { alertRules } = useAlertingContext();
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();

  const hasPendingPicker = !!pendingExpression || !!pendingTransformation;
  const hasPendingCard = hasPendingPicker || !!pendingSavedQuery;
  const isAlertView = cardType === QueryEditorType.Alert;
  const isAlertEmptyState = isAlertView && alertRules.length === 0;

  // The user can delete every card; with nothing pending and no alert view there is nothing to
  // edit, so guide them back to adding a card instead of showing an empty editor surface.
  const isQueriesEmptyState = !isAlertView && !hasPendingCard && queries.length === 0 && transformations.length === 0;

  const shouldShowStackedEditor = stackedMode.enabled && !hasPendingPicker && !isAlertView;
  const shouldShowHeader = !isAlertEmptyState;
  const shouldShowFooter = !hasPendingPicker && !isAlertView;
  const shouldShowDatasourceHelp = !hasPendingPicker && showingDatasourceHelp;

  return (
    <div className={styles.container}>
      {isQueriesEmptyState ? (
        <QueriesEmptyState />
      ) : shouldShowStackedEditor ? (
        <StackedEditorRenderer />
      ) : (
        <>
          {shouldShowHeader && <ContentHeaderSceneWrapper />}
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
