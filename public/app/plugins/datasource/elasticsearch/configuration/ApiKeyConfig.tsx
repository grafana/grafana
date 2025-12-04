import { useState } from 'react';

import { InlineField, SecretInput } from '@grafana/ui';

import { Props } from './ConfigEditor';

export const ApiKeyConfig = (props: Props) => {
  const { options, onOptionsChange } = props;
  const [apiKey, setApiKey] = useState(options.jsonData.apiKey);

  const onResetAPIKey = () => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        apiKey: '',
      },
    });
  };

  return (
    <InlineField label="API Key" labelWidth={14} interactive tooltip={'API Key authentication'}>
      <SecretInput
        required
        id="config-editor-api-key"
        isConfigured={!!options.jsonData.apiKey}
        value={apiKey}
        placeholder="Enter your API key"
        width={40}
        onReset={onResetAPIKey}
        onChange={(e) => setApiKey(e.currentTarget.value)}
        onBlur={() => onOptionsChange({ ...options, jsonData: { ...options.jsonData, apiKey: apiKey } })}
      />
    </InlineField>
  );
};
