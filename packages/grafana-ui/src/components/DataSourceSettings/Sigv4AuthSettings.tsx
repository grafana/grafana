import React from 'react';
import { SecretFormField } from '../SecretFormField/SecretFormField';
import { HttpSettingsProps } from './types';
import { FormField } from '../FormField/FormField';

export const Sigv4AuthSettings: React.FC<HttpSettingsProps> = ({ dataSourceConfig, onChange }) => {
  const accessKey = dataSourceConfig.secureJsonData ? dataSourceConfig.secureJsonData.sigv4AccessKey : '';
  const secretKey = dataSourceConfig.secureJsonData ? dataSourceConfig.secureJsonData.sigv4SecretKey : '';
  const region = dataSourceConfig.jsonData ? dataSourceConfig.jsonData.sigv4Region : '';

  const onSecureJsonDataReset = (fieldName: string) => {
    const state = {
      ...dataSourceConfig,
      secureJsonData: {
        ...dataSourceConfig.secureJsonData,
      },
      secureJsonFields: {
        ...dataSourceConfig.secureJsonFields,
      },
    };
    state.secureJsonData[fieldName] = '';
    state.secureJsonFields[fieldName] = false;

    onChange(state);
  };

  const onSecureJsonDataChange = (fieldName: string, fieldValue: string) => {
    const state = {
      ...dataSourceConfig,
      secureJsonData: {
        ...dataSourceConfig.secureJsonData,
      },
    };
    state.secureJsonData[fieldName] = fieldValue;

    onChange(state);
  };

  const onJsonDataChange = (fieldName: string, fieldValue: string) => {
    const state = {
      ...dataSourceConfig,
      jsonData: {
        ...dataSourceConfig.secureJsonData,
      },
    };
    state.jsonData[fieldName] = fieldValue;

    onChange(state);
  };

  return (
    <>
      <div className="gf-form">
        <FormField
          label="Region"
          labelWidth={10}
          inputWidth={18}
          placeholder="Region"
          value={region || ''}
          onChange={e => onJsonDataChange('sigv4Region', e.target.value)}
        />
      </div>
      <div className="gf-form">
        <SecretFormField
          isConfigured={!!(dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.sigv4AccessKey)}
          label="Access Key"
          labelWidth={10}
          inputWidth={18}
          placeholder="Access Key"
          value={accessKey || ''}
          onReset={() => onSecureJsonDataReset('sigv4AccessKey')}
          onChange={e => onSecureJsonDataChange('sigv4AccessKey', e.target.value)}
        />
      </div>
      <div className="gf-form">
        <SecretFormField
          isConfigured={!!(dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.sigv4SecretKey)}
          label="Secret Key"
          value={secretKey || ''}
          inputWidth={18}
          labelWidth={10}
          placeholder="Secret Key"
          onReset={() => onSecureJsonDataReset('sigv4SecretKey')}
          onChange={e => onSecureJsonDataChange('sigv4SecretKey', e.target.value)}
        />
      </div>
    </>
  );
};
