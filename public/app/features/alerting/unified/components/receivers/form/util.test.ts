import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';

import { DeprecatedAuthHTTPConfig, HTTPAuthConfig, normalizeFormValues } from './util';

describe('normalizeFormValues', () => {
  it('should leave the older config alone', () => {
    const config = createContactPoint({ bearer_token: 'token' });
    expect(normalizeFormValues(config)).toEqual(config);
  });

  it('should leave the older config alone', () => {
    const config = createContactPoint({ bearer_token_file: 'file' });
    expect(normalizeFormValues(config)).toEqual(config);
  });

  it('should normalize newer config', () => {
    const config = createContactPoint({
      authorization: {
        type: 'bearer',
        credentials: 'token',
      },
    });

    expect(normalizeFormValues(config)).toEqual(createContactPoint({ bearer_token: 'token' }));
  });

  it('should normalize newer config', () => {
    const config = createContactPoint({
      authorization: {
        type: 'bearer',
        credentials_file: 'file',
      },
    });

    expect(normalizeFormValues(config)).toEqual(createContactPoint({ bearer_token_file: 'file' }));
  });
});

function createContactPoint(httpConfig: DeprecatedAuthHTTPConfig | HTTPAuthConfig) {
  const config: ReceiverFormValues<ChannelValues> = {
    name: 'My Contact Point',
    items: [
      {
        __id: '',
        type: '',
        secureSettings: {},
        secureFields: {},
        settings: {
          http_config: {
            ...httpConfig,
          },
        },
      },
    ],
  };

  return config;
}
