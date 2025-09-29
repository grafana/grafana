import { css } from '@emotion/css';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ToolbarButton, useTheme2, Dropdown, Menu, ButtonGroup } from '@grafana/ui';
import { useSelector } from 'app/types/store';

import { createDatasourcesList } from '../../core/utils/richHistory';
import { MIXED_DATASOURCE_NAME } from '../../plugins/datasource/mixed/MixedDataSource';

import { useQueriesDrawerContext } from './QueriesDrawer/QueriesDrawerContext';
import { useQueryLibraryContext } from './QueryLibrary/QueryLibraryContext';
import { type OnSelectQueryType } from './QueryLibrary/types';
import { selectExploreDSMaps } from './state/selectors';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryRowButtonHidden?: boolean;
  queryInspectorButtonActive?: boolean;
  sparkJoy?: boolean;

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

  const { queryLibraryEnabled, openDrawer: openQueryLibraryDrawer } = useQueryLibraryContext();
  const { setDrawerOpened } = useQueriesDrawerContext();

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
    </div>
  );
}
