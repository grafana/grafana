import { AnyAction } from '@reduxjs/toolkit';
import { useMemo } from 'react';
import * as React from 'react';

import {
  DataSourcePluginContextProvider,
  DataSourcePluginMeta,
  DataSourceSettings as DataSourceSettingsType,
  PluginExtensionPoints,
  PluginExtensionDataSourceConfigContext,
  DataSourceUpdatedSuccessfully,
} from '@grafana/data';
import { getDataSourceSrv, usePluginComponents, UsePluginComponentsResult } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { DataSourceSettingsState } from 'app/types/datasources';
import { useDispatch } from 'app/types/store';

import {
  useDataSource,
  useDataSourceExploreUrl,
  useDataSourceMeta,
  useDataSourceRights,
  useDataSourceSettings,
  useDeleteLoadedDataSource,
  useInitDataSourceSettings,
  useTestDataSource,
  useUpdateDatasource,
} from '../state/hooks';
import { setIsDefault, setDataSourceName, dataSourceLoaded } from '../state/reducers';
import { trackDsConfigClicked, trackDsConfigUpdated } from '../tracking';
import { DataSourceRights } from '../types';

import { BasicSettings } from './BasicSettings';
import { ButtonRow } from './ButtonRow';
import { CloudInfoBox } from './CloudInfoBox';
import { DataSourceLoadError } from './DataSourceLoadError';
import { DataSourceMissingRightsMessage } from './DataSourceMissingRightsMessage';
import { DataSourcePluginConfigPage } from './DataSourcePluginConfigPage';
import { DataSourcePluginSettings } from './DataSourcePluginSettings';
import { DataSourcePluginState } from './DataSourcePluginState';
import { DataSourceReadOnlyMessage } from './DataSourceReadOnlyMessage';
import { DataSourceTestingStatus } from './DataSourceTestingStatus';

export type Props = {
  // The ID of the data source
  uid: string;
  // The ID of the custom datasource setting page
  pageId?: string | null;
};

export function EditDataSource({ uid, pageId }: Props) {
  useInitDataSourceSettings(uid);

  const dispatch = useDispatch();
  const dataSource = useDataSource(uid);
  const dataSourceMeta = useDataSourceMeta(dataSource.type);
  const dataSourceSettings = useDataSourceSettings();
  const dataSourceRights = useDataSourceRights(uid);
  const exploreUrl = useDataSourceExploreUrl(uid);
  const onDelete = useDeleteLoadedDataSource();
  const onTest = useTestDataSource(uid);
  const onUpdate = useUpdateDatasource();
  const onDefaultChange = (value: boolean) => dispatch(setIsDefault(value));
  const onNameChange = (name: string) => dispatch(setDataSourceName(name));
  const onOptionsChange = (ds: DataSourceSettingsType) => dispatch(dataSourceLoaded(ds));

  return (
    <EditDataSourceView
      pageId={pageId}
      dataSource={dataSource}
      dataSourceMeta={dataSourceMeta}
      dataSourceSettings={dataSourceSettings}
      dataSourceRights={dataSourceRights}
      exploreUrl={exploreUrl}
      onDelete={onDelete}
      onDefaultChange={onDefaultChange}
      onNameChange={onNameChange}
      onOptionsChange={onOptionsChange}
      onTest={onTest}
      onUpdate={onUpdate}
    />
  );
}

export type ViewProps = {
  pageId?: string | null;
  dataSource: DataSourceSettingsType;
  dataSourceMeta: DataSourcePluginMeta;
  dataSourceSettings: DataSourceSettingsState;
  dataSourceRights: DataSourceRights;
  exploreUrl: string;
  onDelete: () => void;
  onDefaultChange: (isDefault: boolean) => AnyAction;
  onNameChange: (name: string) => AnyAction;
  onOptionsChange: (dataSource: DataSourceSettingsType) => AnyAction;
  onTest: () => void;
  onUpdate: (dataSource: DataSourceSettingsType) => Promise<DataSourceSettingsType>;
};

export function EditDataSourceView({
  pageId,
  dataSource,
  dataSourceMeta,
  dataSourceSettings,
  dataSourceRights,
  exploreUrl,
  onDelete,
  onDefaultChange,
  onNameChange,
  onOptionsChange,
  onTest,
  onUpdate,
}: ViewProps) {
  const { plugin, loadError, testingStatus, loading } = dataSourceSettings;
  const { readOnly, hasWriteRights, hasDeleteRights } = dataSourceRights;
  const hasDataSource = dataSource.id > 0 && dataSource.uid;
  const { components, isLoading } = useDataSourceConfigPluginExtensions();
  // This is a workaround to avoid race-conditions between the `setSecureJsonData()` and `setJsonData()` calls instantiated by the extension components.
  // Both those exposed functions are calling `onOptionsChange()` with the new jsonData and secureJsonData, and if they are called in the same tick, the Redux store
  // (which provides the `datasource` object) won't be updated yet, and they override each others `jsonData` value.
  let currentJsonData = dataSource.jsonData;
  let currentSecureJsonData = dataSource.secureJsonData;

  const isPDCInjected = components.some((component) => component.meta.pluginId === 'grafana-pdc-app');

  const dataSourceWithIsPDCInjected = {
    ...dataSource,
    jsonData: {
      ...dataSource.jsonData,
      pdcInjected: isPDCInjected,
    },
  };

  const dsi = getDataSourceSrv()?.getInstanceSettings(dataSource.uid);

  const onSubmit = async (e: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    trackDsConfigClicked('save_and_test');

    try {
      await onUpdate({ ...dataSource });
      trackDsConfigUpdated({ item: 'success' });
      appEvents.publish(new DataSourceUpdatedSuccessfully());
    } catch (error) {
      trackDsConfigUpdated({ item: 'fail' });
      return;
    }

    onTest();
  };

  if (loading || isLoading) {
    return <PageLoader />;
  }

  if (loadError || !hasDataSource || !dsi) {
    return (
      <DataSourceLoadError
        notFound={!hasDataSource || !dsi}
        dataSourceRights={dataSourceRights}
        onDelete={() => {
          trackDsConfigClicked('delete');
          onDelete();
        }}
      />
    );
  }

  if (pageId) {
    return (
      <DataSourcePluginContextProvider instanceSettings={dsi}>
        <DataSourcePluginConfigPage pageId={pageId} plugin={plugin} />
      </DataSourcePluginContextProvider>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {!hasWriteRights && <DataSourceMissingRightsMessage />}
      {readOnly && <DataSourceReadOnlyMessage />}
      {dataSourceMeta.state && <DataSourcePluginState state={dataSourceMeta.state} />}

      <CloudInfoBox dataSource={dataSource} />

      <BasicSettings
        dataSourceName={dataSource.name}
        isDefault={dataSource.isDefault}
        onDefaultChange={onDefaultChange}
        onNameChange={onNameChange}
        disabled={readOnly || !hasWriteRights}
      />

      {plugin && (
        <DataSourcePluginContextProvider instanceSettings={dsi}>
          <DataSourcePluginSettings
            plugin={plugin}
            dataSource={dataSourceWithIsPDCInjected}
            dataSourceMeta={dataSourceMeta}
            onModelChange={onOptionsChange}
          />
        </DataSourcePluginContextProvider>
      )}

      {/* Extension point */}
      {components.map((Component) => {
        return (
          <div key={Component.meta.id}>
            <Component
              context={{
                dataSource,
                dataSourceMeta,
                testingStatus,
                setJsonData: (jsonData) => {
                  currentJsonData = { ...currentJsonData, ...jsonData };
                  onOptionsChange({
                    ...dataSource,
                    secureJsonData: { ...currentSecureJsonData },
                    jsonData: currentJsonData,
                  });
                },
                setSecureJsonData: (secureJsonData) => {
                  currentSecureJsonData = { ...currentSecureJsonData, ...secureJsonData };
                  onOptionsChange({
                    ...dataSource,
                    jsonData: { ...currentJsonData },
                    secureJsonData: currentSecureJsonData,
                  });
                },
              }}
            />
          </div>
        );
      })}

      <DataSourceTestingStatus testingStatus={testingStatus} exploreUrl={exploreUrl} dataSource={dataSource} />

      <ButtonRow
        onSubmit={onSubmit}
        onDelete={() => {
          trackDsConfigClicked('delete');
          onDelete();
        }}
        onTest={() => {
          trackDsConfigClicked('test');
          onTest();
        }}
        canDelete={!readOnly && hasDeleteRights}
        canSave={!readOnly && hasWriteRights}
      />
    </form>
  );
}

type DataSourceConfigPluginExtensionProps = {
  context: PluginExtensionDataSourceConfigContext;
};

function useDataSourceConfigPluginExtensions(): UsePluginComponentsResult<DataSourceConfigPluginExtensionProps> {
  const { components, isLoading } = usePluginComponents<DataSourceConfigPluginExtensionProps>({
    extensionPointId: PluginExtensionPoints.DataSourceConfig,
  });

  return useMemo(() => {
    const allowedComponents = components.filter((component) => {
      switch (component.meta.pluginId) {
        case 'grafana-pdc-app':
        case 'grafana-auth-app':
          return true;
        default:
          return false;
      }
    });

    return { components: allowedComponents, isLoading };
  }, [components, isLoading]);
}
