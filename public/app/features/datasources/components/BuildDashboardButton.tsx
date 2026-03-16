import { DataSourceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, ComponentSize, Dropdown, Icon, LinkButton, Menu } from '@grafana/ui';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { useDispatch } from 'app/types/store';

import { ButtonFill } from '../../../../../packages/grafana-ui/src/components/Button/Button';
import { trackCreateDashboardClicked, trackDsConfigClicked } from '../tracking';

import { SuggestedDashboardsLoader } from './SuggestedDashboardsLoader';

interface BuildDashboardButtonProps {
  dataSource: DataSourceSettings;
  size: ComponentSize;
  fill: ButtonFill;
}

export const BuildDashboardButton = ({ dataSource, size, fill }: BuildDashboardButtonProps) => {
  const dispatch = useDispatch();

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
                onClick={(e) => {
                  e.nativeEvent.stopPropagation();
                  trackDsConfigClicked('build_a_dashboard');
                  openModal();
                }}
              />
              <Menu.Item
                label={t('datasources.build-a-dashboard-button.blank', 'Blank')}
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
