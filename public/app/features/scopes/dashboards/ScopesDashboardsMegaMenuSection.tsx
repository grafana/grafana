import { css } from '@emotion/css';
import { Observable } from 'rxjs';

import { type GrafanaTheme2 } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { Trans, t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { Button, LoadingPlaceholder, ScrollContainer, Text, useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';

/**
 * Renders the scopes-suggested dashboards tree as a section inside the native mega menu, below the
 * pinned box and above the regular nav tree. Unlike the standalone docked drawer this replaces,
 * this section is passive nav content: it renders nothing at all when there's nothing to show,
 * rather than an explanatory empty state, since it's part of the ambient nav rather than something
 * the user deliberately opened.
 */
export function ScopesDashboardsMegaMenuSection() {
  const styles = useStyles2(getStyles);
  const scopes = useScopes();
  const scopeServices = useScopesServices();

  useObservable(
    scopeServices?.scopesDashboardsService.stateObservable ?? new Observable(),
    scopeServices?.scopesDashboardsService.state
  );

  if (!scopeServices || !scopes || !scopes.state.enabled || scopes.state.readOnly) {
    return null;
  }

  const { scopesDashboardsService } = scopeServices;
  const { loading, forScopeNames, dashboards, scopeNavigations, searchQuery, filteredFolders } =
    scopesDashboardsService.state;
  const { changeSearchQuery, updateFolder, clearSearchQuery } = scopesDashboardsService;

  if (!loading && (forScopeNames.length === 0 || (dashboards.length === 0 && scopeNavigations.length === 0))) {
    return null;
  }

  return (
    <>
      <div className={styles.heading}>
        <Text variant="bodySmall" color="secondary" weight="medium">
          {t('scopes.dashboards.megaMenuSectionHeading', 'Suggested dashboards')}
        </Text>
        <div className={styles.headingLine} />
      </div>
      <div className={styles.container} data-testid="scopes-dashboards-container">
        <ScopesDashboardsTreeSearch
          disabled={loading}
          query={searchQuery}
          onChange={changeSearchQuery}
          showNavigationToggle={false}
        />

        {loading ? (
          <LoadingPlaceholder
            className={styles.loadingIndicator}
            text={t('scopes.dashboards.loading', 'Loading dashboards')}
            data-testid="scopes-dashboards-loading"
          />
        ) : filteredFolders[''] ? (
          <ScrollContainer>
            <ScopesDashboardsTree
              folders={filteredFolders}
              folderPath={['']}
              subScopePath={[]}
              onFolderUpdate={updateFolder}
            />
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
      <hr className={styles.dividerLine} />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      alignItems: 'center',
      color: theme.colors.text.secondary,
      display: 'flex',
      gap: theme.spacing(1),
      height: theme.spacing(3.5),
      paddingLeft: theme.spacing(2),
      marginBottom: theme.spacing(0.5),
    }),
    headingLine: css({
      flexGrow: 1,
      height: '1px',
      background: `linear-gradient(90deg, ${theme.colors.border.weak} 65%, transparent 100%)`,
      marginRight: theme.spacing(1),
    }),
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 1, 1),
    }),
    noResultsContainer: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(2, 0),
      margin: 0,
      textAlign: 'center',
    }),
    loadingIndicator: css({
      alignSelf: 'center',
    }),
    dividerLine: css({
      border: 'none',
      flexShrink: 0,
      height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${theme.colors.border.weak} 20%, ${theme.colors.border.weak} 80%, transparent 100%)`,
      margin: theme.spacing(1),
    }),
  };
};
