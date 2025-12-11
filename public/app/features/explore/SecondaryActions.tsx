import { css } from '@emotion/css';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { Components, selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ToolbarButton, useTheme2 } from '@grafana/ui';

import { useQueriesDrawerContext } from './QueriesDrawer/QueriesDrawerContext';
import { useQueryLibraryContext } from './QueryLibrary/QueryLibraryContext';
import { type OnSelectQueryType } from './QueryLibrary/types';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryRowButtonHidden?: boolean;
  queryInspectorButtonActive?: boolean;

  onClickAddQueryRowButton: () => void;
  onClickQueryInspectorButton: () => void;
  onSelectQueryFromLibrary: OnSelectQueryType;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    containerMargin: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
    }),
  };
};

export function SecondaryActions({
  addQueryRowButtonDisabled,
  addQueryRowButtonHidden,
  onClickAddQueryRowButton,
  onClickQueryInspectorButton,
  onSelectQueryFromLibrary,
  queryInspectorButtonActive,
}: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { queryLibraryEnabled, openDrawer: openQueryLibraryDrawer } = useQueryLibraryContext();
  const { drawerOpened, setDrawerOpened } = useQueriesDrawerContext();

  return (
    <div className={styles.containerMargin}>
      {!addQueryRowButtonHidden && (
        <>
          <ToolbarButton
            variant="canvas"
            aria-label={t('explore.secondary-actions.query-add-button-aria-label', 'Add query')}
            onClick={onClickAddQueryRowButton}
            disabled={addQueryRowButtonDisabled}
            icon="plus"
          >
            <Trans i18nKey="explore.secondary-actions.query-add-button">Add query</Trans>
          </ToolbarButton>
          {queryLibraryEnabled && (
            <ToolbarButton
              data-testid={selectors.pages.Explore.General.addFromQueryLibrary}
              aria-label={t('explore.secondary-actions.add-from-query-library', 'Add from saved queries')}
              variant="canvas"
              onClick={() =>
                openQueryLibraryDrawer({
                  onSelectQuery: onSelectQueryFromLibrary,
                  options: { context: CoreApp.Explore },
                })
              }
              icon="plus"
              disabled={addQueryRowButtonDisabled}
            >
              <Trans i18nKey="explore.secondary-actions.add-from-query-library">Add from saved queries</Trans>
            </ToolbarButton>
          )}
        </>
      )}
      <ToolbarButton
        key="query-history"
        variant={drawerOpened ? 'active' : 'canvas'}
        aria-label={t('explore.secondary-actions.query-history-button-aria-label', 'Query history')}
        onClick={() => setDrawerOpened(!drawerOpened)}
        data-testid={Components.QueryTab.queryHistoryButton}
        icon="history"
      >
        <Trans i18nKey="explore.secondary-actions.query-history-button">Query history</Trans>
      </ToolbarButton>
      <ToolbarButton
        variant={queryInspectorButtonActive ? 'active' : 'canvas'}
        aria-label={t('explore.secondary-actions.query-inspector-button-aria-label', 'Query inspector')}
        onClick={onClickQueryInspectorButton}
        icon="info-circle"
      >
        <Trans i18nKey="explore.secondary-actions.query-inspector-button">Query inspector</Trans>
      </ToolbarButton>
    </div>
  );
}
