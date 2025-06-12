import { css, cx } from '@emotion/css';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { Button, LoadingPlaceholder, ScrollContainer, useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';

export function ScopesDashboards() {
  const styles = useStyles2(getStyles);
  const scopes = useScopes();
  const scopeServices = useScopesServices();

  useObservable(
    scopeServices?.scopesDashboardsService.stateObservable ?? new Observable(),
    scopeServices?.scopesDashboardsService.state
  );

  if (!scopeServices || !scopes || !scopes.state.enabled || !scopes.state.drawerOpened || scopes.state.readOnly) {
    return null;
  }

  const { scopesDashboardsService } = scopeServices;
  const { loading, forScopeNames, dashboards, scopeNavigations, searchQuery, filteredFolders } =
    scopesDashboardsService.state;
  const { changeSearchQuery, updateFolder, clearSearchQuery } = scopesDashboardsService;

  if (!loading) {
    if (forScopeNames.length === 0) {
      return (
        <div
          className={cx(styles.container, styles.noResultsContainer)}
          data-testid="scopes-dashboards-notFoundNoScopes"
        >
          <Trans i18nKey="scopes.dashboards.noResultsNoScopes">No scopes selected</Trans>
        </div>
      );
    } else if (dashboards.length === 0 && scopeNavigations.length === 0) {
      return (
        <div
          className={cx(styles.container, styles.noResultsContainer)}
          data-testid="scopes-dashboards-notFoundForScope"
        >
          <Trans i18nKey="scopes.dashboards.noResultsForScopes">
            No dashboards or links found for the selected scopes
          </Trans>
        </div>
      );
    }
  }

  return (
    <div className={styles.container} data-testid="scopes-dashboards-container">
      <ScopesDashboardsTreeSearch disabled={loading} query={searchQuery} onChange={changeSearchQuery} />

      {loading ? (
        <LoadingPlaceholder
          className={styles.loadingIndicator}
          text={t('scopes.dashboards.loading', 'Loading dashboards')}
          data-testid="scopes-dashboards-loading"
        />
      ) : filteredFolders[''] ? (
        <ScrollContainer>
          <ScopesDashboardsTree folders={filteredFolders} folderPath={['']} onFolderUpdate={updateFolder} />
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
