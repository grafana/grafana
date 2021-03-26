import React, { useState } from 'react';
import { DataSourceApi, PanelData, PanelPlugin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { CustomScrollbar, Drawer, TabContent } from '@grafana/ui';
import { getPanelInspectorStyles } from 'app/features/inspector/styles';
import { InspectMetadataTab } from 'app/features/inspector/InspectMetadataTab';
import { InspectSubtitle } from 'app/features/inspector/InspectSubtitle';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectTab } from 'app/features/inspector/types';
import { DashboardModel, PanelModel } from '../../state';
import { GetDataOptions } from '../../../query/state/PanelQueryRunner';

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
  if (!tabs.find((item) => item.value === currentTab)) {
    activeTab = InspectTab.JSON;
  }
  const title = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text');

  return (
    <Drawer
      title={`Inspect: ${title || 'Panel'}`}
      subtitle={
        <InspectSubtitle
          tabs={tabs}
          tab={activeTab}
          data={data}
          onSelectTab={(item) => setCurrentTab(item.value || InspectTab.Data)}
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
          {data && activeTab === InspectTab.Query && (
            <QueryInspector panel={panel} data={data.series} onRefreshQuery={() => panel.refresh()} />
          )}
        </TabContent>
      </CustomScrollbar>
    </Drawer>
  );
};
