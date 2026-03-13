import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Dropdown, Icon, Menu } from '@grafana/ui';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { useDispatch } from 'app/types/store';

import { trackCreateDashboardClicked, trackDsConfigClicked } from '../tracking';

import { SuggestedDashboardsLoader } from './SuggestedDashboardsLoader';

interface BuildADashboardButtonProps {
  dataSource: { uid: string; type: string; typeName: string };
  size?: 'sm' | 'md';
}

export const BuildADashboardButton = ({ dataSource, size = 'sm' }: BuildADashboardButtonProps) => {
  const dispatch = useDispatch();

  return (
    <SuggestedDashboardsLoader
      dataSource={dataSource}
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
          <Button size={size} variant="secondary" fill={size === 'md' ? 'outline' : undefined}>
            <Trans i18nKey="datasources.build-a-dashboard-button.build-a-dashboard">Build a dashboard</Trans>
            <Icon name="angle-down" />
          </Button>
        </Dropdown>
      )}
    </SuggestedDashboardsLoader>
  );
};
