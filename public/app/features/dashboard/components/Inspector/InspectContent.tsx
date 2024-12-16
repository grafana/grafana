import { isEmpty } from 'lodash';
import { useState } from 'react';

import {
  CoreApp,
  DataSourceApi,
  formattedValueToString,
  getValueFormat,
  PanelData,
  PanelPlugin,
  LoadingState,
  DataQueryError,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { InspectMetadataTab } from 'app/features/inspector/InspectMetadataTab';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectTab } from 'app/features/inspector/types';

import { GetDataOptions } from '../../../query/state/PanelQueryRunner';
import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  defaultTab?: InspectTab;
  tabs: Array<{ label: string; value: InspectTab }>;
  // The last raw response
  data?: PanelData;
  isDataLoading: boolean;
  dataOptions: GetDataOptions;
  // If the datasource supports custom metadata
  metadataDatasource?: DataSourceApi;
  onDataOptionsChange: (options: GetDataOptions) => void;
  onClose: () => void;
}

export const InspectContent = ({
  panel,
  plugin,
  dashboard,
  tabs,
  data,
  isDataLoading,
  dataOptions,
  metadataDatasource,
  defaultTab,
  onDataOptionsChange,
  onClose,
}: Props) => {
  const [currentTab, setCurrentTab] = useState(defaultTab ?? InspectTab.Data);

  if (!plugin) {
    return null;
  }

  let errors = getErrors(data);

  // Validate that the active tab is actually valid and allowed
  let activeTab = currentTab;
  if (!tabs.find((item) => item.value === currentTab)) {
    activeTab = InspectTab.JSON;
  }

  const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';
  const title = t('dashboard.inspect.title', 'Inspect: {{panelTitle}}', { panelTitle });

  return (
    <Drawer
      title={title}
      subtitle={data && formatStats(data)}
      onClose={onClose}
      tabs={
        <TabsBar>
          {tabs.map((tab, index) => {
            return (
              <Tab
                key={`${tab.value}-${index}`}
                label={tab.label}
                active={tab.value === activeTab}
                onChangeTab={() => setCurrentTab(tab.value || InspectTab.Data)}
              />
            );
          })}
        </TabsBar>
      }
    >
      {activeTab === InspectTab.Data && (
        <InspectDataTab
          dataName={panel.getDisplayTitle()}
          panelPluginId={panel.type}
          fieldConfig={panel.fieldConfig}
          hasTransformations={Boolean(panel.transformations?.length)}
          data={data && data.series}
          isLoading={isDataLoading}
          options={dataOptions}
          onOptionsChange={onDataOptionsChange}
          timeZone={dashboard.timezone}
          app={CoreApp.Dashboard}
        />
      )}
      {data && activeTab === InspectTab.Meta && (
        <InspectMetadataTab data={data} metadataDatasource={metadataDatasource} />
      )}

      {activeTab === InspectTab.JSON && (
        <InspectJSONTab panel={panel} dashboard={dashboard} data={data} onClose={onClose} />
      )}
      {activeTab === InspectTab.Error && <InspectErrorTab errors={errors} />}
      {data && activeTab === InspectTab.Stats && <InspectStatsTab data={data} timeZone={dashboard.getTimezone()} />}
      {data && activeTab === InspectTab.Query && <QueryInspector data={data} onRefreshQuery={() => panel.refresh()} />}
    </Drawer>
  );
};

// This will combine
function getErrors(data: PanelData | undefined): DataQueryError[] {
  let errors = data?.errors ?? [];
  if (data?.error && !errors.includes(data.error)) {
    errors = [data.error, ...errors];
  }
  if (!errors.length && data?.state === LoadingState.Error) {
    return [
      {
        message: 'Error loading data',
      },
    ];
  }
  return errors;
}

function formatStats(data: PanelData) {
  const { request } = data;

  if (!request || isEmpty(request)) {
    return '';
  }

  const queryCount = request.targets.length;
  const requestTime = request.endTime ? request.endTime - request.startTime : 0;
  const formatted = formattedValueToString(getValueFormat('ms')(requestTime));

  return (
    <Trans i18nKey="dashboard.inspect.subtitle">
      {{ queryCount }} queries with total query time of {{ formatted }}
    </Trans>
  );
}
