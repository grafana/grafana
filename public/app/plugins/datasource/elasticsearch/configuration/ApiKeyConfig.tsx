import { onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginResetOption } from '@grafana/data';
import { InlineField, SecretInput } from '@grafana/ui';

import { Props } from './ConfigEditor';

export const ApiKeyConfig = (props: Props) => {
  const { options } = props;

  return (
    <InlineField label="API Key" labelWidth={14} interactive tooltip={'API Key authentication'}>
      <SecretInput
        required
        id="config-editor-api-key"
        isConfigured={!!options.secureJsonFields?.apiKey}
        placeholder="Enter your API key"
        width={40}
        onReset={() => updateDatasourcePluginResetOption(props, 'apiKey')}
        onChange={onUpdateDatasourceSecureJsonDataOption(props, 'apiKey')}
      />
    </InlineField>
  );
};
