import { css } from '@emotion/css';
import { useState } from 'react';

import { CoreApp, GrafanaTheme2, type PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction, usePluginLinks } from '@grafana/runtime';
import { ToolbarButton, useTheme2, Dropdown, Menu, ButtonGroup } from '@grafana/ui';
import { useSelector } from 'app/types/store';

import { createDatasourcesList } from '../../core/utils/richHistory';
import { MIXED_DATASOURCE_NAME } from '../../plugins/datasource/mixed/MixedDataSource';

import { useQueriesDrawerContext } from './QueriesDrawer/QueriesDrawerContext';
import { useQueryLibraryContext } from './QueryLibrary/QueryLibraryContext';
import { type OnSelectQueryType } from './QueryLibrary/types';
import { ConfirmNavigationModal } from './extensions/ConfirmNavigationModal';
import { selectExploreDSMaps, getExploreItemSelector } from './state/selectors';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryRowButtonHidden?: boolean;
  queryInspectorButtonActive?: boolean;
  sparkJoy?: boolean;
  exploreId: string;

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
  sparkJoy = false,
  exploreId,
}: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const exploreActiveDS = useSelector(selectExploreDSMaps);

  // Prefill the query library filter with the dataSource.
  // Get current dataSource that is open. As this is only used in Explore we get it from Explore state.
  const listOfDatasources = createDatasourcesList();
  const activeDatasources = exploreActiveDS.dsToExplore
    .map((eDs) => {
      return listOfDatasources.find((ds) => ds.uid === eDs.datasource?.uid)?.name;
    })
    .filter((name): name is string => !!name && name !== MIXED_DATASOURCE_NAME);

  // Use the same logic as ToolbarExtensionPoint to get queryless extensions
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    context: {
      exploreId,
      targets: useSelector(getExploreItemSelector(exploreId))?.queries || [],
      data: useSelector(getExploreItemSelector(exploreId))?.queryResponse,
      timeRange: useSelector(getExploreItemSelector(exploreId))?.range?.raw,
      timeZone: 'browser',
      shouldShowAddCorrelation: false,
    },
    limitPerPlugin: 3,
  });

  const QUERYLESS_APPS = [
    'grafana-pyroscope-app',
    'grafana-lokiexplore-app',
    'grafana-exploretraces-app',
    'grafana-metricsdrilldown-app',
  ];

  const selectExploreItem = getExploreItemSelector(exploreId);
  const noQueriesInPane = Boolean(useSelector(selectExploreItem)?.queries?.length);
  const querylessExtensions = links.filter((link) => QUERYLESS_APPS.includes(link.pluginId));

  const { queryLibraryEnabled, openDrawer: openQueryLibraryDrawer } = useQueryLibraryContext();
  const { setDrawerOpened } = useQueriesDrawerContext();
  
  // State for queryless extensions modal
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();

  // Debug logging
  console.log('SecondaryActions Debug:', {
    sparkJoy,
    querylessExtensionsLength: querylessExtensions.length,
    querylessExtensions,
    noQueriesInPane,
    exploreId,
    allLinksLength: links.length,
  });

  return (
    <div className={styles.containerMargin}>
      {!addQueryRowButtonHidden && (
        <>
          {sparkJoy ? (
            <ButtonGroup>
              <ToolbarButton
                variant="canvas"
                aria-label={t('explore.secondary-actions.query-add-button-aria-label', 'Add query')}
                onClick={onClickAddQueryRowButton}
                disabled={addQueryRowButtonDisabled}
                icon="plus"
              >
                <Trans i18nKey="explore.secondary-actions.query-add-button">Add query</Trans>
              </ToolbarButton>
              <Dropdown
                overlay={
                  <Menu>
                    <Menu.Item
                      icon="history"
                      label={t('explore.secondary-actions.query-history-button', 'Query history')}
                      onClick={() => setDrawerOpened(true)}
                      disabled={addQueryRowButtonDisabled}
                    />
                    {queryLibraryEnabled && (
                      <Menu.Item
                        icon="book"
                        label={t('explore.secondary-actions.add-from-query-library', 'Add from saved queries')}
                        onClick={() =>
                          openQueryLibraryDrawer({
                            datasourceFilters: activeDatasources,
                            onSelectQuery: onSelectQueryFromLibrary,
                            options: { context: CoreApp.Explore },
                          })
                        }
                        disabled={addQueryRowButtonDisabled}
                        data-testid={selectors.pages.Explore.General.addFromQueryLibrary}
                      />
                    )}
                    <Menu.Item
                      icon="bolt"
                      label={t('explore.secondary-actions.kick-start', 'Kick start your query')}
                      onClick={() => {
                        setDrawerOpened(false);
                        // Fire a global app event consumed by editors in Explore when sparkJoy is enabled
                        // Using legacy appEvents API for simplicity
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const { getAppEvents } = require('@grafana/runtime');
                        getAppEvents().publish({ type: 'explore-kickstart-open' });
                      }}
                      disabled={addQueryRowButtonDisabled}
                    />
                    {querylessExtensions.length > 0 && (
                      <Menu.Item
                        icon="external-link-alt"
                        label={t('explore.toolbar.add-to-queryless-extensions', 'Go queryless')}
                        onClick={() => {
                          if (querylessExtensions.length === 1) {
                            const extension = querylessExtensions[0];
                            setSelectedExtension(extension);
                            reportInteraction('grafana_explore_queryless_app_link_clicked', {
                              pluginId: extension.pluginId,
                            });
                          }
                          // For multiple extensions, we could show a submenu or handle differently
                          // For now, just select the first one as per the original QuerylessAppsExtensions logic
                        }}
                        disabled={!Boolean(noQueriesInPane)}
                      />
                    )}
                  </Menu>
                }
                placement="bottom-start"
              >
                <ToolbarButton variant="canvas" aria-label={t('explore.secondary-actions.add-more-aria', 'More add options')} icon="angle-down" />
              </Dropdown>
            </ButtonGroup>
          ) : (
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
                      datasourceFilters: activeDatasources,
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
        </>
      )}
      <ToolbarButton
        variant={queryInspectorButtonActive ? 'active' : 'canvas'}
        aria-label={t('explore.secondary-actions.query-inspector-button-aria-label', 'Query inspector')}
        onClick={onClickQueryInspectorButton}
        icon="info-circle"
      >
        <Trans i18nKey="explore.secondary-actions.query-inspector-button">Query inspector</Trans>
      </ToolbarButton>
      {!!selectedExtension && !!selectedExtension.path && (
        <ConfirmNavigationModal
          path={selectedExtension.path}
          title={selectedExtension.title}
          onDismiss={() => setSelectedExtension(undefined)}
        />
      )}
    </div>
  );
}
