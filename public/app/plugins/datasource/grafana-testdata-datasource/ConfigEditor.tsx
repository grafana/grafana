// Libraries
import { memo } from 'react';

import { type DataSourceJsonData, type DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineField, Input, SecretInput } from '@grafana/ui';

interface TestDataJsonData extends DataSourceJsonData {
  host?: string;
}

interface TestDataSecureJsonData {
  password?: string;
}

type Props = DataSourcePluginOptionsEditorProps<TestDataJsonData, TestDataSecureJsonData>;

/**
 * Demo config editor for the TestData datasource: a plain "host" text field
 * (stored in jsonData) and a secret "password" field (stored in secureJsonData).
 */
export const ConfigEditor = memo<Props>(({ options, onOptionsChange }) => {
  const { jsonData, secureJsonData, secureJsonFields } = options;
  const passwordConfigured = Boolean(secureJsonFields?.password);

  return (
    <>
      <InlineField label="Host" labelWidth={14} tooltip="Demo host field stored in jsonData">
        <Input
          width={40}
          placeholder="localhost"
          value={jsonData.host ?? ''}
          onChange={(e) =>
            onOptionsChange({
              ...options,
              jsonData: { ...jsonData, host: e.currentTarget.value },
            })
          }
        />
      </InlineField>

      <InlineField label="Password" labelWidth={14} tooltip="Demo secret field stored in secureJsonData">
        <SecretInput
          width={40}
          isConfigured={passwordConfigured}
          value={secureJsonData?.password ?? ''}
          placeholder="password"
          onReset={() =>
            onOptionsChange({
              ...options,
              secureJsonFields: { ...secureJsonFields, password: false },
              secureJsonData: { ...secureJsonData, password: '' },
            })
          }
          onChange={(e) =>
            onOptionsChange({
              ...options,
              secureJsonData: { ...secureJsonData, password: e.currentTarget.value },
            })
          }
        />
      </InlineField>
    </>
  );
});

ConfigEditor.displayName = 'ConfigEditor';
