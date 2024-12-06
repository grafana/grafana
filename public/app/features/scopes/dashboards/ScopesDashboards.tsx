import { css, cx } from '@emotion/css';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { useScopes } from '@grafana/scenes';
import { Button, LoadingPlaceholder, ScrollContainer, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesDashboardsService } from './ScopesDashboardsService';
import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';

export function ScopesDashboards() {
  const styles = useStyles2(getStyles);
  const scopes = useScopes();

  const scopesDashboardsService = ScopesDashboardsService.instance;

  useObservable(scopesDashboardsService?.stateObservable ?? new Observable(), scopesDashboardsService?.state);

  if (
    !scopes ||
    !scopesDashboardsService ||
    !scopes.state.isEnabled ||
    !scopes.state.isDrawerOpened ||
    scopes.state.isReadOnly
  ) {
    return null;
  }

  if (!scopesDashboardsService.state.isLoading) {
    if (scopesDashboardsService.state.forScopeNames.length === 0) {
      return (
        <div
          className={cx(styles.container, styles.noResultsContainer)}
          data-testid="scopes-dashboards-notFoundNoScopes"
        >
          <Trans i18nKey="scopes.dashboards.noResultsNoScopes">No scopes selected</Trans>
        </div>
      );
    } else if (scopesDashboardsService.state.dashboards.length === 0) {
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
      <ScopesDashboardsTreeSearch
        disabled={scopesDashboardsService.state.isLoading}
        query={scopesDashboardsService.state.searchQuery}
        onChange={scopesDashboardsService.changeSearchQuery}
      />

      {scopesDashboardsService.state.isLoading ? (
        <LoadingPlaceholder
          className={styles.loadingIndicator}
          text={t('scopes.dashboards.loading', 'Loading dashboards')}
          data-testid="scopes-dashboards-loading"
        />
      ) : scopesDashboardsService.state.filteredFolders[''] ? (
        <ScrollContainer>
          <ScopesDashboardsTree
            folders={scopesDashboardsService.state.filteredFolders}
            folderPath={['']}
            onFolderUpdate={scopesDashboardsService.updateFolder}
          />
        </ScrollContainer>
      ) : (
        <p className={styles.noResultsContainer} data-testid="scopes-dashboards-notFoundForFilter">
          <Trans i18nKey="scopes.dashboards.noResultsForFilter">No results found for your query</Trans>

          <Button
            variant="secondary"
            onClick={scopesDashboardsService.clearSearchQuery}
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
