import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorType } from '../constants';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { CardEditorRenderer } from './CardEditorRenderer';
import { ContentHeaderSceneWrapper } from './Header/ContentHeader';
import { QueryEditorMainHeader } from './Header/QueryEditorMainHeader';
import { QueriesEmptyState } from './QueriesEmptyState';
import {
  useAlertingContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { SingleItemRenderer } from './StackedEditor/SingleItemRenderer';
import { StackedEditorRenderer } from './StackedEditor/StackedEditorRenderer';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);

  const { cardType, pendingExpression, pendingTransformation, pendingSavedQuery, stackedMode } =
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

  const renderContent = () => {
    if (isQueriesEmptyState) {
      return <QueriesEmptyState />;
    }

    if (isAlertView || hasPendingPicker) {
      return (
        <>
          {!isAlertEmptyState && <ContentHeaderSceneWrapper />}
          <QueryEditorBody>
            <CardEditorRenderer />
          </QueryEditorBody>
        </>
      );
    }

    return (
      <>
        <QueryEditorMainHeader />
        {stackedMode.enabled ? <StackedEditorRenderer /> : <SingleItemRenderer />}
      </>
    );
  };

  return <div className={styles.container}>{renderContent()}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    // Flush to the editor's bottom edge, so the lower corners are squared.
    borderBottomLeftRadius: 'unset',
    borderBottomRightRadius: 'unset',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  }),
});
