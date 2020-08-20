import React, { useState } from 'react';
import { getPanelInspectorStyles } from './styles';
import { CustomScrollbar, Drawer, TabContent } from '@grafana/ui';
import { InspectSubtitle } from './InspectSubtitle';
import { InspectDataTab } from './InspectDataTab';
import { InspectMetadataTab } from './InspectMetadataTab';
import { InspectJSONTab } from './InspectJSONTab';
import { InspectErrorTab } from './InspectErrorTab';
import { InspectStatsTab } from './InspectStatsTab';
import { QueryInspector } from './QueryInspector';
import { InspectTab } from './types';
import { DashboardModel, PanelModel } from '../../state';
import { DataSourceApi, PanelData, PanelPlugin } from '@grafana/data';
import { GetDataOptions } from '../../state/PanelQueryRunner';

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

export const InspectContent: React.FC<Props> = ({
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
}) => {
  const [currentTab, setCurrentTab] = useState(defaultTab ?? InspectTab.Data);

  if (!plugin) {
    return null;
  }

  const styles = getPanelInspectorStyles();
  const error = data?.error;

  // Validate that the active tab is actually valid and allowed
  let activeTab = currentTab;
  if (!tabs.find(item => item.value === currentTab)) {
    activeTab = InspectTab.JSON;
  }

  return (
    <Drawer
      title={`Inspect: ${panel.title}` || 'Panel inspect'}
      subtitle={
        <InspectSubtitle
          tabs={tabs}
          tab={activeTab}
          data={data}
          onSelectTab={item => setCurrentTab(item.value || InspectTab.Data)}
        />
      }
      width="50%"
      onClose={onClose}
      expandable
    >
      {activeTab === InspectTab.Data && (
        <InspectDataTab
          panel={panel}
          data={data && data.series}
          isLoading={isDataLoading}
          options={dataOptions}
          onOptionsChange={onDataOptionsChange}
        />
      )}
      <CustomScrollbar autoHeightMin="100%">
        <TabContent className={styles.tabContent}>
          {data && activeTab === InspectTab.Meta && (
            <InspectMetadataTab data={data} metadataDatasource={metadataDatasource} />
          )}

          {activeTab === InspectTab.JSON && (
            <InspectJSONTab panel={panel} dashboard={dashboard} data={data} onClose={onClose} />
          )}
          {activeTab === InspectTab.Error && <InspectErrorTab error={error} />}
          {data && activeTab === InspectTab.Stats && <InspectStatsTab data={data} timeZone={dashboard.getTimezone()} />}
          {data && activeTab === InspectTab.Query && <QueryInspector panel={panel} data={data.series} />}
        </TabContent>
      </CustomScrollbar>
    </Drawer>
  );
};
