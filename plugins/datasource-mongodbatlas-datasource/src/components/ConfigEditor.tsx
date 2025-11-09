import React from 'react';
import { Field, Input, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';

export const ConfigEditor = (props: DataSourcePluginOptionsEditorProps<any>) => {
  const { options, onOptionsChange } = props;

  const updateOption = (key: string, value: string) => {
    const jsonData = {
      ...options.jsonData,
      [key]: value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  return (
    <>
      <Field label="Cluster Name" description="MongoDB Atlas cluster name">
        <Input
          value={options.jsonData.clusterName || ''}
          onChange={(e) => updateOption('clusterName', e.currentTarget.value)}
        />
      </Field>

      <Field label="Database Name" description="Target database in your cluster">
        <Input
          value={options.jsonData.databaseName || ''}
          onChange={(e) => updateOption('databaseName', e.currentTarget.value)}
        />
      </Field>

      <Field label="Collection Name" description="Collection to query">
        <Input
          value={options.jsonData.collectionName || ''}
          onChange={(e) => updateOption('collectionName', e.currentTarget.value)}
        />
      </Field>

      <Field label="API Key" description="MongoDB Atlas API key">
  <SecretInput
    isConfigured={Boolean(options.secureJsonFields?.apiKey)}
    value=""
    onReset={() => {
      onOptionsChange({
        ...options,
        secureJsonFields: {
          ...options.secureJsonFields,
          apiKey: false,
        },
        secureJsonData: {
          ...options.secureJsonData,
          apiKey: '',
        },
      });
    }}
    onChange={(e) => {
      onOptionsChange({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          apiKey: e.currentTarget.value,
        },
        secureJsonFields: {
          ...options.secureJsonFields,
          apiKey: true,
        },
      });
    }}
  />
</Field>

    </>
  );
};
