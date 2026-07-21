import { css } from '@emotion/css';
import { Observable } from 'rxjs';

import { type GrafanaTheme2 } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { Trans, t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { Button, Divider, LoadingPlaceholder, ScrollContainer, useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';

interface ScopesDashboardsProps {
  inline?: boolean;
}

export function ScopesDashboards({ inline = false }: ScopesDashboardsProps = {}) {
  const styles = useStyles2(getStyles, inline);
  const scopes = useScopes();
  const scopeServices = useScopesServices();

  useObservable(
    scopeServices?.scopesDashboardsService.stateObservable ?? new Observable(),
    scopeServices?.scopesDashboardsService.state
  );

  if (!scopeServices || !scopes || !scopes.state.enabled || scopes.state.readOnly) {
    return null;
  }

  if (!inline && !scopes.state.drawerOpened) {
    return null;
  }

  const { scopesDashboardsService } = scopeServices;
  const { loading, forScopeNames, dashboards, scopeNavigations, searchQuery, filteredFolders } =
    scopesDashboardsService.state;
  const { changeSearchQuery, updateFolder, clearSearchQuery } = scopesDashboardsService;

  if (!loading) {
    if (forScopeNames.length === 0) {
      if (inline) {
        return null;
      }
      return (
        <div className={styles.container} data-testid="scopes-dashboards-container">
          <ScopesDashboardsTreeSearch disabled={loading} query={searchQuery} onChange={changeSearchQuery} />

          <div className={styles.noResultsContainer} data-testid="scopes-dashboards-notFoundNoScopes">
            <Trans i18nKey="scopes.dashboards.noResultsNoScopes">No scopes selected</Trans>
          </div>
        </div>
      );
    } else if (dashboards.length === 0 && scopeNavigations.length === 0) {
      return (
        <>
          {inline && <Divider spacing={1} />}
          <div className={styles.container} data-testid="scopes-dashboards-container">
            <div className={styles.noResultsContainer} data-testid="scopes-dashboards-notFoundForScope">
              <Trans i18nKey="scopes.dashboards.noResultsForScopes">
                No dashboards or links found for the selected scopes
              </Trans>
            </div>
          </div>
        </>
      );
    }
  }

  return (
    <>
      {inline && <Divider spacing={1} />}
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
    </>
  );
}

const getStyles = (theme: GrafanaTheme2, inline: boolean) => {
  return {
    container: css({
      backgroundColor: inline ? 'transparent' : theme.colors.background.canvas,
      borderRight: inline ? undefined : `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      height: inline ? undefined : '100%',
      gap: theme.spacing(1),
      padding: inline ? theme.spacing(0, 1) : theme.spacing(0, 2),
      margin: inline ? theme.spacing(1, 0) : theme.spacing(2, 0),
      width: inline ? undefined : theme.spacing(37.5),
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
