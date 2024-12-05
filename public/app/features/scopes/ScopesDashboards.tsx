import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useScopes } from '@grafana/scenes';
import { Button, LoadingPlaceholder, ScrollContainer, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesDashboardsTree } from './internal/ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './internal/ScopesDashboardsTreeSearch';
import { useScopesDashboardsService } from './useScopesDashboardsService';

export function ScopesDashboards() {
  const styles = useStyles2(getStyles);
  const scopes = useScopes();
  const scopesDashboardsService = useScopesDashboardsService();

  if (
    !scopes ||
    !scopesDashboardsService ||
    !scopes?.state.isEnabled ||
    !scopesDashboardsService.state?.isOpened ||
    scopes.state.isReadOnly
  ) {
    return null;
  }

  const { state, changeSearchQuery, clearSearchQuery, updateFolder } = scopesDashboardsService;

  if (!state.isLoading) {
    if (state.forScopeNames.length === 0) {
      return (
        <div
          className={cx(styles.container, styles.noResultsContainer)}
          data-testid="scopes-dashboards-notFoundNoScopes"
        >
          <Trans i18nKey="scopes.dashboards.noResultsNoScopes">No scopes selected</Trans>
        </div>
      );
    } else if (state.dashboards.length === 0) {
      return (
        <div
          className={cx(styles.container, styles.noResultsContainer)}
          data-testid="scopes-dashboards-notFoundForScope"
        >
          <Trans i18nKey="scopes.dashboards.noResultsForScopes">No dashboards found for the selected scopes</Trans>
        </div>
      );
    }
  }

  return (
    <div className={styles.container} data-testid="scopes-dashboards-container">
      <ScopesDashboardsTreeSearch disabled={state.isLoading} query={state.searchQuery} onChange={changeSearchQuery} />

      {state.isLoading ? (
        <LoadingPlaceholder
          className={styles.loadingIndicator}
          text={t('scopes.dashboards.loading', 'Loading dashboards')}
          data-testid="scopes-dashboards-loading"
        />
      ) : state.filteredFolders[''] ? (
        <ScrollContainer>
          <ScopesDashboardsTree folders={state.filteredFolders} folderPath={['']} onFolderUpdate={updateFolder} />
        </ScrollContainer>
      ) : (
        <p className={styles.noResultsContainer} data-testid="scopes-dashboards-notFoundForFilter">
          <Trans i18nKey="scopes.dashboards.noResultsForFilter">No results found for your query</Trans>

          <Button
            variant="secondary"
            onClick={clearSearchQuery}
            data-testid="scopes-dashboards-notFoundForFilter-clear"
          >
            <Trans i18nKey="scopes.dashboards.noResultsForFilterClear">Clear search</Trans>
          </Button>
        </p>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      backgroundColor: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: theme.spacing(1),
      padding: theme.spacing(2),
      width: theme.spacing(37.5),
    }),
    noResultsContainer: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      justifyContent: 'center',
      margin: 0,
      textAlign: 'center',
    }),
    loadingIndicator: css({
      alignSelf: 'center',
    }),
  };
};
