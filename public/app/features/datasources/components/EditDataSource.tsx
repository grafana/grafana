import { type AnyAction } from '@reduxjs/toolkit';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import {
  config,
  usePluginComponents,
  type UsePluginComponentsResult,
  useDataSourceInstanceSettings,
} from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { SaveProvisionedResourceDrawer } from 'app/features/provisioning/components/Shared/SaveProvisionedResourceDrawer';
import {
  isManagedByRepository,
  isManagedResourceReadOnly,
  type ManagedResource,
} from 'app/features/provisioning/utils/managedResource';
import { type DataSourceSettingsState } from 'app/types/datasources';
import { useDispatch } from 'app/types/store';

import { useRetryDatasourceAdvisorCheck } from '../../connections/hooks/useDatasourceAdvisorChecks';
import {
  convertLegacyDatasourceSettingsToK8sDatasourceSettings,
  DATASOURCE_K8S_VERSION,
  getDataSourceK8sResourceByUid,
} from '../api';
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
import { dataSourceLoaded, testDataSourceFailed } from '../state/reducers';
import { trackDsConfigClicked, trackDsConfigUpdated } from '../tracking';
import { type DataSourceRights } from '../types';

import { ButtonRow } from './ButtonRow';
import { CloudInfoBox } from './CloudInfoBox';
import { DataSourceDefaultButton } from './DataSourceDefaultButton';
import { DataSourceLoadError } from './DataSourceLoadError';
import { DataSourceMissingRightsMessage } from './DataSourceMissingRightsMessage';
import { DataSourcePluginConfigPage } from './DataSourcePluginConfigPage';
import { DataSourcePluginSettings } from './DataSourcePluginSettings';
import { DataSourcePluginState } from './DataSourcePluginState';
import { DataSourceManagedReadOnlyMessage, DataSourceReadOnlyMessage } from './DataSourceReadOnlyMessage';
import { DataSourceTestingStatus } from './DataSourceTestingStatus';
import { type DataSourceProvisioning } from './useDataSourceProvisioning';

/** Shape the provisioning save drawer commits. Built by {@link toProvisionedDataSource}. */
type ProvisionedDataSource = {
  apiVersion: string;
  kind: string;
  metadata: { name: string; annotations?: Record<string, string> };
  spec: Record<string, unknown>;
  secure?: Record<string, Record<string, string>>;
};

export type Props = {
  // The ID of the data source
  uid: string;
  // The ID of the custom datasource setting page
  pageId?: string | null;
  // Provisioning state of this data source, read once by the page that owns the header badge
  provisioning?: DataSourceProvisioning;
};

export function EditDataSource({ uid, pageId, provisioning }: Props) {
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
  const onOptionsChange = (ds: DataSourceSettingsType) => dispatch(dataSourceLoaded(ds));

  return (
    <EditDataSourceView
      pageId={pageId}
      dataSource={dataSource}
      provisioning={provisioning}
      dataSourceMeta={dataSourceMeta}
      dataSourceSettings={dataSourceSettings}
      dataSourceRights={dataSourceRights}
      exploreUrl={exploreUrl}
      onDelete={onDelete}
      onOptionsChange={onOptionsChange}
      onTest={onTest}
      onUpdate={onUpdate}
    />
  );
}

export type ViewProps = {
  pageId?: string | null;
  dataSource: DataSourceSettingsType;
  /** Provisioning state of this data source; omit it to render the page with no provisioning surfaces. */
  provisioning?: DataSourceProvisioning;
  dataSourceMeta: DataSourcePluginMeta;
  dataSourceSettings: DataSourceSettingsState;
  dataSourceRights: DataSourceRights;
  exploreUrl: string;
  onDelete: () => void;
  onOptionsChange: (dataSource: DataSourceSettingsType) => AnyAction;
  onTest: () => void;
  onUpdate: (dataSource: DataSourceSettingsType) => Promise<DataSourceSettingsType>;
};

export function EditDataSourceView({
  pageId,
  dataSource,
  provisioning,
  dataSourceMeta,
  dataSourceSettings,
  dataSourceRights,
  exploreUrl,
  onDelete,
  onOptionsChange,
  onTest,
  onUpdate,
}: ViewProps) {
  const dispatch = useDispatch();
  const [provisionedDataSource, setProvisionedDataSource] = useState<ProvisionedDataSource | undefined>();
  const { plugin, loadError, testingStatus, loading } = dataSourceSettings;
  const { readOnly, hasWriteRights, hasDeleteRights } = dataSourceRights;
  const managedResource = provisioning?.resource;
  // Repository-managed data sources are committed to git through the save drawer; every other
  // manager that does not allow edits makes the page read-only, as it does for dashboards.
  const isRepositoryManaged = Boolean(managedResource && isManagedByRepository(managedResource));
  const isManagerReadOnly = Boolean(managedResource && isManagedResourceReadOnly(managedResource));
  const hasDataSource = dataSource.id > 0 && dataSource.uid;
  const { components, isLoading } = useDataSourceConfigPluginExtensions();
  const { settings: instanceSettings, isLoading: isLoadingInstanceSettings } = useDataSourceInstanceSettings(
    dataSource.uid
  );

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

      if (isRepositoryManaged && managedResource) {
        setProvisionedDataSource(await toProvisionedDataSource(dataSource, managedResource));
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
    [validation, onUpdate, dataSource, onTest, dispatch, retryAdvisorCheck, isRepositoryManaged, managedResource]
  );

  if (loading || isLoading || isLoadingInstanceSettings || provisioning?.isLoading) {
    return <PageLoader />;
  }

  if (loadError || !hasDataSource || !instanceSettings) {
    return (
      <DataSourceLoadError
        notFound={!hasDataSource || !instanceSettings}
        errorMsg={loadError}
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
      <DataSourcePluginContextProvider instanceSettings={instanceSettings}>
        <DataSourcePluginConfigPage pageId={pageId} plugin={plugin} />
      </DataSourcePluginContextProvider>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {!hasWriteRights && <DataSourceMissingRightsMessage />}
      {readOnly && <DataSourceReadOnlyMessage />}
      {isManagerReadOnly && <DataSourceManagedReadOnlyMessage />}
      {dataSourceMeta.state && <DataSourcePluginState state={dataSourceMeta.state} />}

      <CloudInfoBox dataSource={dataSource} />

      {plugin && (
        <DataSourcePluginContextProvider instanceSettings={instanceSettings}>
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
        canDelete={!readOnly && !isManagerReadOnly && hasDeleteRights}
        canSave={!readOnly && !isManagerReadOnly && hasWriteRights}
      >
        <DataSourceDefaultButton uid={dataSource.uid} />
      </ButtonRow>
      {provisionedDataSource && (
        <SaveProvisionedResourceDrawer
          resource={provisionedDataSource}
          title={dataSource.name}
          action="update"
          onDismiss={() => setProvisionedDataSource(undefined)}
        />
      )}
    </form>
  );
}

/**
 * The data source as the provisioning drawer commits it: the edited settings as a Kubernetes
 * DataSource, keeping the stored object's annotations (which resolve the repository and the file
 * path) and its secure-value references, since the form only ever holds newly entered secrets.
 */
async function toProvisionedDataSource(
  dataSource: DataSourceSettingsType,
  managedResource: ManagedResource
): Promise<ProvisionedDataSource> {
  const converted = convertLegacyDatasourceSettingsToK8sDatasourceSettings(
    dataSource,
    config.namespace,
    DATASOURCE_K8S_VERSION
  );
  // The secure-value references are not on the connection, so read the stored object for them. Only
  // on the way into the drawer, which is the only thing that needs them.
  const stored = await getDataSourceK8sResourceByUid(dataSource.uid, config.namespace).catch(() => undefined);
  return {
    apiVersion: converted.apiVersion,
    kind: converted.kind,
    metadata: { name: dataSource.uid, annotations: managedResource.metadata?.annotations },
    spec: { ...converted.spec },
    ...(stored?.secure ? { secure: stored.secure } : {}),
  };
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
