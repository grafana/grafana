import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';

import { matchesOnlyOneTemplate } from './fields/utils';
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

  it('should normalize even if authorization is not defined', () => {
    const config = createContactPoint({});
    expect(normalizeFormValues(config)).toEqual(createContactPoint({}));
  });
});

function createContactPoint(httpConfig: DeprecatedAuthHTTPConfig | HTTPAuthConfig) {
  const config: ReceiverFormValues<ChannelValues> = {
    name: 'My Contact Point',
    items: [
      {
        __id: '',
        type: '',
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

describe('matchesOnlyOneTemplate', () => {
  it('should return true when there is only one template and no other text', () => {
    const fieldValue = '{{ template "nested" . }}';
    expect(matchesOnlyOneTemplate(fieldValue)).toBe(true);
  });

  it('should return false when there is more than one template', () => {
    const fieldValue = '{{ template "nested" . }}{{ template "nested2" . }}';
    expect(matchesOnlyOneTemplate(fieldValue)).toBe(false);
  });

  it('should return false when there is other text outside the template', () => {
    const fieldValue = '{{ template "nested" . }} some other text';
    expect(matchesOnlyOneTemplate(fieldValue)).toBe(false);
  });

  it('should return false when there is no template', () => {
    const fieldValue = 'some other text';
    expect(matchesOnlyOneTemplate(fieldValue)).toBe(false);
  });
});
