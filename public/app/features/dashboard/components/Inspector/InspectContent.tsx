import { t } from '@lingui/macro';
import React, { useState } from 'react';

import { CoreApp, DataSourceApi, formattedValueToString, getValueFormat, PanelData, PanelPlugin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { InspectMetadataTab } from 'app/features/inspector/InspectMetadataTab';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectTab } from 'app/features/inspector/types';

import { GetDataOptions } from '../../../query/state/PanelQueryRunner';
import { DashboardModel, PanelModel } from '../../state';

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

  const error = data?.error;

  // Validate that the active tab is actually valid and allowed
  let activeTab = currentTab;
  if (!tabs.find((item) => item.value === currentTab)) {
    activeTab = InspectTab.JSON;
  }

  const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';
  const title = t({
    id: 'dashboard.inspect.title',
    message: `Inspect: ${panelTitle}`,
  });

  return (
    <Drawer
      title={title}
      subtitle={data && formatStats(data)}
      width="50%"
      onClose={onClose}
      expandable
      scrollableContent
      tabs={
        <TabsBar>
          {tabs.map((t, index) => {
            return (
              <Tab
                key={`${t.value}-${index}`}
                label={t.label}
                active={t.value === activeTab}
                onChangeTab={() => setCurrentTab(t.value || InspectTab.Data)}
              />
            );
          })}
        </TabsBar>
      }
    >
      {activeTab === InspectTab.Data && (
        <InspectDataTab
          panel={panel}
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
      {activeTab === InspectTab.Error && <InspectErrorTab error={error} />}
      {data && activeTab === InspectTab.Stats && <InspectStatsTab data={data} timeZone={dashboard.getTimezone()} />}
      {data && activeTab === InspectTab.Query && (
        <QueryInspector panel={panel} data={data.series} onRefreshQuery={() => panel.refresh()} />
      )}
    </Drawer>
  );
};

function formatStats(data: PanelData) {
  const { request } = data;
  if (!request) {
    return '';
  }

  const queryCount = request.targets.length;
  const requestTime = request.endTime ? request.endTime - request.startTime : 0;
  const formatted = formattedValueToString(getValueFormat('ms')(requestTime));

  return t({
    id: 'dashboard.inspect.subtitle',
    message: `${queryCount} queries with total query time of ${formatted}`,
  });
}
