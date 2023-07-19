import { omit } from 'lodash';

import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';

export interface DeprecatedAuthHTTPConfig {
  bearer_token?: string;
  bearer_token_file?: string;
}

export interface HTTPAuthConfig {
  authorization: {
    type: string;
    credentials?: string;
    credentials_file?: string;
  };
}

// convert the newer http_config to the older (deprecated) format
export function normalizeFormValues(
  values?: ReceiverFormValues<ChannelValues>
): ReceiverFormValues<ChannelValues> | undefined {
  if (!values) {
    return;
  }

  return {
    ...values,
    items: values.items.map((item) => ({
      ...item,
      settings: {
        ...item.settings,
        http_config: item.settings?.http_config ? normalizeHTTPConfig(item.settings?.http_config) : undefined,
      },
    })),
  };
}

function normalizeHTTPConfig(config: HTTPAuthConfig | DeprecatedAuthHTTPConfig): DeprecatedAuthHTTPConfig {
  if (isDeprecatedHTTPAuthConfig(config)) {
    return config;
  }

  return {
    ...omit(config, 'authorization'),
    bearer_token: config.authorization.credentials,
    bearer_token_file: config.authorization.credentials_file,
  };
}

function isDeprecatedHTTPAuthConfig(
  config: HTTPAuthConfig | DeprecatedAuthHTTPConfig
): config is DeprecatedAuthHTTPConfig {
  return ['bearer_token', 'bearer_token_file'].some((prop) => prop in config);
}
