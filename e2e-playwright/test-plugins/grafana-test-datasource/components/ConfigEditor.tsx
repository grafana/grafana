import { ChangeEvent } from 'react';
import { Checkbox, InlineField, InlineSwitch, Input, SecretInput, Select } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, SelectableValue, toOption } from '@grafana/data';
import { MyDataSourceOptions, MySecureJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions, MySecureJsonData> {}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData, secureJsonFields, secureJsonData } = options;

  const onJsonDataChange = (key: string, value: string | number | boolean) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        [key]: value,
      },
    });
  };

  // Secure field (only sent to the backend)
  const onSecureJsonDataChange = (key: string, value: string | number) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        [key]: value,
      },
    });
  };

  const onResetAPIKey = () => {
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
  };

  return (
    <>
      <InlineField label="Path" labelWidth={14} interactive tooltip={'Json field returned to frontend'}>
        <Input
          id="config-editor-path"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onJsonDataChange('path', e.target.value)}
          value={jsonData.path}
          placeholder="Enter the path, e.g. /api/v1"
          width={40}
        />
      </InlineField>
      <InlineField label="API Key" labelWidth={14} interactive tooltip={'Secure json field (backend only)'}>
        <SecretInput
          required
          id="config-editor-api-key"
          isConfigured={secureJsonFields.apiKey}
          value={secureJsonData?.apiKey}
          placeholder="Enter your API key"
          width={40}
          onReset={onResetAPIKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSecureJsonDataChange('path', e.target.value)}
        />
      </InlineField>
      <InlineField label="Switch Enabled">
        <InlineSwitch
          width={40}
          label="Switch Enabled"
          value={jsonData.switchEnabled ?? false}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onJsonDataChange('switchEnabled', e.target.checked)}
        />
      </InlineField>
      <InlineField label="Checkbox Enabled">
        <Checkbox
          width={40}
          id="config-checkbox-enabled"
          value={jsonData.checkboxEnabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onJsonDataChange('checkboxEnabled', e.target.checked)}
        />
      </InlineField>
      <InlineField label="Auth type">
        <Select
          width={40}
          inputId="config-auth-type"
          value={jsonData.authType ?? 'keys'}
          options={['keys', 'credentials'].map(toOption)}
          onChange={(e: SelectableValue<string>) => onJsonDataChange('authType', e.value!)}
        />
      </InlineField>
    </>
  );
}
