import { AnyAction } from '@reduxjs/toolkit';
import React from 'react';
import { useDispatch } from 'react-redux';

import { DataSourcePluginMeta, DataSourceSettings as DataSourceSettingsType } from '@grafana/data';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { DataSourceSettingsState, ThunkResult } from 'app/types';

import {
  dataSourceLoaded,
  setDataSourceName,
  setIsDefault,
  useDataSource,
  useDataSourceExploreUrl,
  useDataSourceMeta,
  useDataSourceRights,
  useDataSourceSettings,
  useDeleteLoadedDataSource,
  useInitDataSourceSettings,
  useTestDataSource,
  useUpdateDatasource,
} from '../state';
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
  const dataSourceMeta = useDataSourceMeta(uid);
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
  onTest: () => ThunkResult<void>;
  onUpdate: (dataSource: DataSourceSettingsType) => ThunkResult<void>;
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
  const hasDataSource = dataSource.id > 0;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    await onUpdate({ ...dataSource });

    onTest();
  };

  if (loadError) {
    return <DataSourceLoadError dataSourceRights={dataSourceRights} onDelete={onDelete} />;
  }

  if (loading) {
    return <PageLoader />;
  }

  // TODO - is this needed?
  if (!hasDataSource) {
    return null;
  }

  if (pageId) {
    return <DataSourcePluginConfigPage pageId={pageId} plugin={plugin} />;
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
      />

      {plugin && (
        <DataSourcePluginSettings
          plugin={plugin}
          dataSource={dataSource}
          dataSourceMeta={dataSourceMeta}
          onModelChange={onOptionsChange}
        />
      )}

      <DataSourceTestingStatus testingStatus={testingStatus} />

      <ButtonRow
        onSubmit={onSubmit}
        onDelete={onDelete}
        onTest={onTest}
        exploreUrl={exploreUrl}
        canSave={!readOnly && hasWriteRights}
        canDelete={!readOnly && hasDeleteRights}
      />
    </form>
  );
}
