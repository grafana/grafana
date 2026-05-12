import { css } from '@emotion/css';

import { type DataSourceSettings, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, type ComponentSize, Dropdown, Icon, LinkButton, Menu, useStyles2 } from '@grafana/ui';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { CONTENT_KINDS, SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { useDispatch } from 'app/types/store';

import { type ButtonFill } from '../../../../../packages/grafana-ui/src/components/Button/Button';
import { trackBuildDashboardDropdownClicked, trackCreateDashboardClicked, trackDsConfigClicked } from '../tracking';

import { SuggestedDashboardsLoader } from './SuggestedDashboardsLoader';

interface BuildDashboardButtonProps {
  dataSource: DataSourceSettings;
  size: ComponentSize;
  fill: ButtonFill;
  context: 'datasource_page' | 'datasource_list';
}

export const BuildDashboardButton = ({ dataSource, size, fill, context }: BuildDashboardButtonProps) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  if (!config.featureToggles.suggestedDashboards) {
    return (
      <LinkButton
        size={size}
        variant="secondary"
        fill={fill}
        href={`dashboard/new-with-ds/${dataSource.uid}`}
        onClick={() => {
          trackDsConfigClicked('build_a_dashboard');
          trackCreateDashboardClicked({
            grafana_version: config.buildInfo.version,
            datasource_uid: dataSource.uid,
            plugin_name: dataSource.typeName,
            path: window.location.pathname,
          });
        }}
      >
        <Trans i18nKey="datasources.build-a-dashboard-button.build-a-dashboard">Build a dashboard</Trans>
      </LinkButton>
    );
  }

  return (
    <SuggestedDashboardsLoader
      datasourceUid={dataSource.uid}
      sourceEntryPoint={
        context === 'datasource_page'
          ? SOURCE_ENTRY_POINTS.DATASOURCE_PAGE_BUILD_BUTTON
          : SOURCE_ENTRY_POINTS.DATASOURCE_LIST_BUILD_BUTTON
      }
      onFetchComplete={(hasDashboards) => {
        if (!hasDashboards) {
          dispatch(notifyApp(createWarningNotification('No dashboards found for this data source')));
        }
      }}
    >
      {({ fetchStatus, hasDashboards, triggerFetch, openModal }) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item
                label={t('datasources.build-a-dashboard-button.from-suggestions', 'From suggestions')}
                icon={fetchStatus === 'loading' ? 'spinner' : 'lightbulb-alt'}
                disabled={fetchStatus === 'loading' || (fetchStatus === 'done' && !hasDashboards)}
                className={
                  fetchStatus === 'loading' || (fetchStatus === 'done' && !hasDashboards)
                    ? styles.disabledItem
                    : undefined
                }
                onClick={(e) => {
                  e.nativeEvent.stopPropagation();
                  DashboardLibraryInteractions.entryPointClicked({
                    entryPoint:
                      context === 'datasource_page'
                        ? SOURCE_ENTRY_POINTS.DATASOURCE_PAGE_BUILD_BUTTON
                        : SOURCE_ENTRY_POINTS.DATASOURCE_LIST_BUILD_BUTTON,
                    contentKind: CONTENT_KINDS.SUGGESTED_DASHBOARDS,
                  });
                  openModal();
                }}
              />
              <Menu.Item
                label={t('datasources.build-a-dashboard-button.new-dashboard', 'New dashboard')}
                icon="plus"
                url={`dashboard/new-with-ds/${dataSource.uid}`}
                onClick={() => {
                  trackDsConfigClicked('build_a_dashboard');
                  trackCreateDashboardClicked({
                    grafana_version: config.buildInfo.version,
                    datasource_uid: dataSource.uid,
                    plugin_name: dataSource.typeName,
                    path: window.location.pathname,
                  });
                }}
              />
            </Menu>
          }
          onVisibleChange={(isOpen) => {
            if (isOpen) {
              trackBuildDashboardDropdownClicked({
                grafana_version: config.buildInfo.version,
                datasource_uid: dataSource.uid,
                plugin_name: dataSource.typeName,
                path: window.location.pathname,
              });
              triggerFetch();
            }
          }}
        >
          <Button size={size} variant="secondary" fill={fill}>
            <Trans i18nKey="datasources.build-a-dashboard-button.build-a-dashboard">Build a dashboard</Trans>
            <Icon name="angle-down" />
          </Button>
        </Dropdown>
      )}
    </SuggestedDashboardsLoader>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  disabledItem: css({
    cursor: 'not-allowed',
    '& span': {
      color: theme.colors.action.disabledText,
    },
    '& svg': {
      color: theme.colors.action.disabledText,
    },
  }),
});
