import { type AnyAction } from '@reduxjs/toolkit';
import { useCallback, useMemo, useRef } from 'react';
import * as React from 'react';

import {
  DataSourcePluginContextProvider,
  type DataSourceConfigValidationAPI,
  type DataSourcePluginMeta,
  type DataSourceSettings as DataSourceSettingsType,
  PluginExtensionPoints,
  type PluginExtensionDataSourceConfigContext,
  DataSourceUpdatedSuccessfully,
} from '@grafana/data';
import { getDataSourceSrv, usePluginComponents, type UsePluginComponentsResult } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type DataSourceSettingsState } from 'app/types/datasources';
import { useDispatch } from 'app/types/store';

import { useRetryDatasourceAdvisorCheck } from '../../connections/hooks/useDatasourceAdvisorChecks';
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
import { setIsDefault, setDataSourceName, dataSourceLoaded, testDataSourceFailed } from '../state/reducers';
import { trackDsConfigClicked, trackDsConfigUpdated } from '../tracking';
import { type DataSourceRights } from '../types';

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
  const dispatch = useDispatch();
  const { plugin, loadError, testingStatus, loading } = dataSourceSettings;
  const { readOnly, hasWriteRights, hasDeleteRights } = dataSourceRights;
  const hasDataSource = dataSource.id > 0 && dataSource.uid;
  const { components, isLoading } = useDataSourceConfigPluginExtensions();

  // Validation API passed to the config editor. validate() is called in onSubmit
  // — if it returns false the save and health check are both skipped.
  // Errors are stored in a ref so the validation object stays stable (same
  // reference across renders). Inline error display in the plugin uses its own
  // local useState — it does not depend on this store for re-renders.
  const validators = useRef(new Set<() => Promise<boolean> | boolean>());
  const validationErrorsRef = useRef<Record<string, string>>({});

  const validationRef = useRef<DataSourceConfigValidationAPI | null>(null);
  if (!validationRef.current) {
    validationRef.current = {
      registerValidation(validator) {
        validators.current.add(validator);
        return () => validators.current.delete(validator);
      },
      async validate() {
        const results = await Promise.all(Array.from(validators.current).map((v) => Promise.resolve(v())));
        return results.every(Boolean);
      },
      isValid() {
        return Object.keys(validationErrorsRef.current).length === 0;
      },
      getErrors() {
        return validationErrorsRef.current;
      },
      setError(field, message) {
        validationErrorsRef.current = { ...validationErrorsRef.current, [field]: message };
      },
      clearError(field) {
        if (field in validationErrorsRef.current) {
          const next = { ...validationErrorsRef.current };
          delete next[field];
          validationErrorsRef.current = next;
        }
      },
    };
  }
  const validation = validationRef.current;
  const retryAdvisorCheck = useRetryDatasourceAdvisorCheck();
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

  const onSubmit = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      trackDsConfigClicked('save_and_test');

      const valid = await validation.validate();
      if (!valid) {
        // Inline errors are already shown via validation.setError calls inside the
        // registered validators. Also surface a summary in the standard testing-status
        // slot so the user knows why save was blocked.
        const errors = validation.getErrors();
        const message = Object.values(errors).join(' · ') || 'Please fill in all required fields.';
        dispatch(testDataSourceFailed({ message, status: 'error' }));
        return;
      }

      try {
        await onUpdate({ ...dataSource });
        trackDsConfigUpdated({ item: 'success' });
        appEvents.publish(new DataSourceUpdatedSuccessfully());
      } catch (error) {
        trackDsConfigUpdated({ item: 'fail' });
        return;
      }
      retryAdvisorCheck(dataSource.uid).catch((error) => {
        console.warn('Error retrying datasource advisor check', error);
      });
      onTest();
    },
    [validation, onUpdate, dataSource, onTest, dispatch, retryAdvisorCheck]
  );

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

      {plugin && (
        <DataSourcePluginContextProvider instanceSettings={dsi}>
          <DataSourcePluginSettings
            plugin={plugin}
            dataSource={dataSourceWithIsPDCInjected}
            dataSourceMeta={dataSourceMeta}
            onModelChange={onOptionsChange}
            validation={validation}
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
