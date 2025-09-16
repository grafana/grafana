import { GrafanaManagedContactPoint, Receiver } from '../../../../plugins/datasource/alertmanager/types';
import { grafanaAlertNotifiers } from '../mockGrafanaNotifiers';
import {
  CloudChannelValues,
  GrafanaChannelMap,
  GrafanaChannelValues,
  ReceiverFormValues,
} from '../types/receiver-form';

import {
  convertJiraFieldToJson,
  convertJsonToJiraField,
  formValuesToCloudReceiver,
  formValuesToGrafanaReceiver,
  grafanaReceiverToFormValues,
  omitEmptyUnlessExisting,
  omitEmptyValues,
  omitTemporaryIdentifiers,
} from './receiver-form';

describe('Receiver form utils', () => {
  describe('omitEmptyStringValues', () => {
    it('should recursively omit empty strings but leave other properties in palce', () => {
      const original = {
        one: 'two',
        remove: '',
        three: 0,
        four: null,
        five: [
          [
            {
              foo: 'bar',
              remove: '',
              notDefined: undefined,
            },
          ],
          {
            foo: 'bar',
            remove: '',
          },
        ],
      };

      const expected = {
        one: 'two',
        three: 0,
        five: [
          [
            {
              foo: 'bar',
            },
          ],
          {
            foo: 'bar',
          },
        ],
      };

      expect(omitEmptyValues(original)).toEqual(expected);
    });
  });
  describe('omitEmptyUnlessExisting', () => {
    it('should omit empty strings if no entry in existing', () => {
      const existing = {
        five_keep: true,
      };
      const original = {
        one: 'two',
        two_remove: '',
        three: 0,
        four_remove: null,
        five_keep: '',
      };

      const expected = {
        one: 'two',
        three: 0,
        five_keep: '',
      };

      expect(omitEmptyUnlessExisting(original, existing)).toEqual(expected);
    });
  });

  describe('omitTemporaryIdentifiers', () => {
    it('should remove __id from the root object', () => {
      const original = {
        __id: '1',
        foo: 'bar',
      };

      const expected = {
        foo: 'bar',
      };

      expect(omitTemporaryIdentifiers(original)).toEqual(expected);
    });

    it('should remove __id from nested objects', () => {
      const original = {
        foo: 'bar',
        nested: {
          __id: '1',
          baz: 'qux',
          doubleNested: { __id: '2', url: 'example.com' },
        },
      };

      const expected = {
        foo: 'bar',
        nested: {
          baz: 'qux',
          doubleNested: { url: 'example.com' },
        },
      };

      expect(omitTemporaryIdentifiers(original)).toEqual(expected);
    });

    it('should remove __id from objects in an array', () => {
      const original = {
        foo: 'bar',
        array: [
          {
            __id: '1',
            baz: 'qux',
            actions: [
              { __id: '3', type: 'email' },
              { __id: '4', type: 'slack' },
            ],
          },
          { __id: '2', quux: 'quuz' },
        ],
      };

      const expected = {
        foo: 'bar',
        array: [
          {
            baz: 'qux',
            actions: [{ type: 'email' }, { type: 'slack' }],
          },
          {
            quux: 'quuz',
          },
        ],
      };

      expect(omitTemporaryIdentifiers(original)).toEqual(expected);
    });

    it('should return a new object and keep the original intact', () => {
      const original = {
        foo: 'bar',
        nested: {
          __id: '1',
          baz: 'qux',
          doubleNested: { __id: '2', url: 'example.com' },
        },
      };

      const withOmitted = omitTemporaryIdentifiers(original);

      expect(withOmitted).not.toBe(original);
      expect(original.nested.__id).toBe('1');
      expect(original.nested.doubleNested.__id).toBe('2');
    });
  });
});

describe('formValuesToGrafanaReceiver', () => {
  const emailChannelValues: GrafanaChannelValues = {
    __id: '__1',
    type: 'email',
    settings: {
      to: 'test@example.com',
    },
    secureFields: {},
    disableResolveMessage: false,
  };

  const slackChannelValues: GrafanaChannelValues = {
    __id: '__2',
    type: 'slack',
    settings: {
      url: 'https://slack.example.com',
      channel: '#alerts',
    },
    secureFields: {},
    disableResolveMessage: false,
  };

  const defaultChannelValues = { ...emailChannelValues };

  it('should convert form values to Grafana receiver with basic settings for a new receiver', () => {
    const formValues: ReceiverFormValues<GrafanaChannelValues> = {
      name: 'my-receiver',
      items: [slackChannelValues],
    };

    const channelMap: GrafanaChannelMap = {};

    const result = formValuesToGrafanaReceiver(formValues, channelMap, defaultChannelValues);

    expect(result).toEqual<GrafanaManagedContactPoint>({
      name: 'my-receiver',
      grafana_managed_receiver_configs: [
        {
          name: 'my-receiver',
          type: 'slack',
          settings: {
            url: 'https://slack.example.com',
            channel: '#alerts',
          },
          secureFields: {},
          disableResolveMessage: false,
        },
      ],
    });
  });

  it('should convert form values to Grafana receiver with uid mapping for existing receiver', () => {
    const formValues: ReceiverFormValues<GrafanaChannelValues> = {
      name: 'my-receiver',
      items: [emailChannelValues, slackChannelValues],
    };

    const channelMap: GrafanaChannelMap = {
      __1: { ...emailChannelValues, secureFields: {}, uid: 'email-1' },
      __2: { ...slackChannelValues, secureFields: {}, uid: 'slack-1' },
    };

    const result = formValuesToGrafanaReceiver(formValues, channelMap, defaultChannelValues);

    expect(result).toEqual<GrafanaManagedContactPoint>({
      name: 'my-receiver',
      grafana_managed_receiver_configs: [
        {
          uid: 'email-1',
          name: 'my-receiver',
          type: 'email',
          settings: { to: 'test@example.com' },
          secureFields: {},
          disableResolveMessage: false,
        },
        {
          uid: 'slack-1',
          name: 'my-receiver',
          type: 'slack',
          settings: { url: 'https://slack.example.com', channel: '#alerts' },
          secureFields: {},
          disableResolveMessage: false,
        },
      ],
    });
  });

  it('should omit empty values from settings', () => {
    const formValues: ReceiverFormValues<GrafanaChannelValues> = {
      name: 'my-receiver',
      items: [
        {
          __id: '__1',
          type: 'email',
          settings: {
            to: 'test@example.com',
            from: '', // empty string
            subject: undefined, // undefined
            body: null, // null
            cc: 'cc@example.com',
          },
          secureFields: {},
          disableResolveMessage: false,
        },
      ],
    };

    const channelMap: GrafanaChannelMap = {
      __1: {
        uid: 'email-1',
        type: 'email',
        settings: {
          to: 'test@example.com',
          from: 'old@example.com', // existing value that should be removed
        },
        secureFields: {},
        disableResolveMessage: false,
      },
    };

    const result = formValuesToGrafanaReceiver(formValues, channelMap, defaultChannelValues);

    expect(result).toEqual<GrafanaManagedContactPoint>({
      name: 'my-receiver',
      grafana_managed_receiver_configs: [
        {
          uid: 'email-1',
          name: 'my-receiver',
          type: 'email',
          settings: {
            to: 'test@example.com',
            cc: 'cc@example.com',
          },
          secureFields: {},
          disableResolveMessage: false,
        },
      ],
    });
  });

  it('should remove falsy secure fields and preserve truthy ones', () => {
    const formValues: ReceiverFormValues<GrafanaChannelValues> = {
      name: 'my-receiver',
      items: [
        {
          __id: '__1',
          type: 'sns',
          settings: { api_url: 'https://sns.example.com' },
          secureFields: {
            // Basic secure fields
            password: true, // should be preserved
            token: false, // should be omitted
            apiKey: '', // should be omitted

            // Nested secure fields with dot notation
            'sigv4.access_key': true, // should be preserved
            'sigv4.secret_key': false, // should be omitted
            'sigv4.session_token': '', // should be omitted
            'other.nested.key': true, // should be preserved
            'other.nested.empty': false, // should be omitted

            // Various falsy values
            secret: false, // should be omitted
            key: '', // should be omitted
            empty: false, // should be omitted
          },
          disableResolveMessage: false,
        },
      ],
    };

    const channelMap: GrafanaChannelMap = {
      __1: {
        uid: 'sns-1',
        type: 'sns',
        settings: { api_url: 'https://sns.example.com' },
        secureFields: {
          // All fields exist in the channel map
          password: true,
          token: true,
          apiKey: true,
          'sigv4.access_key': true,
          'sigv4.secret_key': true,
          'sigv4.session_token': true,
          'other.nested.key': true,
          'other.nested.empty': true,
          secret: true,
          key: true,
          empty: true,
        },
        disableResolveMessage: false,
      },
    };

    const result = formValuesToGrafanaReceiver(formValues, channelMap, defaultChannelValues);

    expect(result).toEqual<GrafanaManagedContactPoint>({
      name: 'my-receiver',
      grafana_managed_receiver_configs: [
        {
          uid: 'sns-1',
          name: 'my-receiver',
          type: 'sns',
          settings: {
            api_url: 'https://sns.example.com',
          },
          secureFields: {
            // Only truthy values should be preserved
            password: true,
            'sigv4.access_key': true,
            'other.nested.key': true,
          },
          disableResolveMessage: false,
        },
      ],
    });
  });
});

describe('formValuesToCloudReceiver', () => {
  it('should remove temporary ids from receivers and settings', () => {
    const formValues: ReceiverFormValues<CloudChannelValues> = {
      name: 'my-receiver',
      items: [
        {
          __id: '1',
          type: 'slack',
          settings: {
            url: 'https://slack.example.com/',
            actions: [{ __id: '2', text: 'Acknowledge', type: 'button' }],
            fields: [{ __id: '10', title: 'priority', value: '1' }],
          },
          secureFields: {},
          sendResolved: true,
        },
      ],
    };

    const defaults: CloudChannelValues = {
      __id: '1',
      type: 'slack',
      settings: {
        url: 'https://slack.example.com/',
      },
      secureFields: {},
      sendResolved: true,
    };

    const expected: Receiver = {
      name: 'my-receiver',
      slack_configs: [
        {
          url: 'https://slack.example.com/',
          actions: [{ text: 'Acknowledge', type: 'button' }],
          fields: [{ title: 'priority', value: '1' }],
          send_resolved: true,
        },
      ],
    };

    expect(formValuesToCloudReceiver(formValues, defaults)).toEqual(expected);
  });
});

describe('grafanaReceiverToFormValues', () => {
  const { slack, sns } = grafanaAlertNotifiers;

  it('should convert fields from settings and secureFields', () => {
    const slackReceiver: GrafanaManagedContactPoint = {
      name: 'slack-receiver',
      grafana_managed_receiver_configs: [
        {
          type: slack.type,
          settings: {
            recipient: '#alerting-ops',
          },
          secureFields: {
            token: true,
          },
        },
      ],
    };

    const [formValues, _] = grafanaReceiverToFormValues(slackReceiver);
    expect(formValues.items[0].type).toBe(slack.type);
    expect(formValues.items[0].settings.recipient).toBe('#alerting-ops');
    expect(formValues.items[0].secureFields.token).toBe(true);
  });

  it('should convert nested settings and secureFields', () => {
    const snsReceiver: GrafanaManagedContactPoint = {
      name: 'sns-receiver',
      grafana_managed_receiver_configs: [
        {
          type: sns.type,
          settings: {
            api_url: 'https://sns.example.com/',
            phone_number: '+1234567890',
            sigv4: { region: 'us-east-1' },
          },
          secureFields: {
            'sigv4.access_key': true,
            'sigv4.secret_key': true,
          },
        },
      ],
    };

    const [formValues, _] = grafanaReceiverToFormValues(snsReceiver);

    expect(formValues.items[0].settings.api_url).toBe('https://sns.example.com/');
    expect(formValues.items[0].settings.phone_number).toBe('+1234567890');
    expect(formValues.items[0].settings.sigv4.region).toBe('us-east-1');
    expect(formValues.items[0].secureFields['sigv4.access_key']).toBe(true);
    expect(formValues.items[0].secureFields['sigv4.secret_key']).toBe(true);
  });
});

describe('convertJsonToJiraField', () => {
  it('should convert nested objects to JSON strings ', () => {
    const input = {
      fields: {
        key1: { nestedKey1: 'nestedValue1' },
        key2: { nestedKey2: 'nestedValue2' },
      },
    };
    const expectedOutput = {
      fields: {
        key1: '{"nestedKey1":"nestedValue1"}',
        key2: '{"nestedKey2":"nestedValue2"}',
      },
    };
    const result = convertJsonToJiraField(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should leave non-object values unchanged ', () => {
    const input = {
      fields: {
        key1: 'value1',
        key2: 123,
        key3: true,
      },
    };
    const result = convertJsonToJiraField(input);
    expect(result).toEqual(input);
  });

  it('should handle fields object with mixed types', () => {
    const input = {
      fields: {
        key1: 'value1',
        key2: { nestedKey2: 'nestedValue2' },
        key3: 123,
        key4: true,
      },
    };
    const expectedOutput = {
      fields: {
        key1: 'value1',
        key2: '{"nestedKey2":"nestedValue2"}',
        key3: 123,
        key4: true,
      },
    };
    const result = convertJsonToJiraField(input);
    expect(result).toEqual(expectedOutput);
  });
});

describe('convertJiraFieldToJson', () => {
  it('should convert stringified objects to nested objects ', () => {
    const input = {
      fields: {
        key1: '{"nestedKey1":{"a":2,"c":[1,2,3 ]}}',
        key2: '{"nestedKey2":"nestedValue2"}',
      },
    };
    const expectedOutput = {
      fields: {
        key1: { nestedKey1: { a: 2, c: [1, 2, 3] } },
        key2: { nestedKey2: 'nestedValue2' },
      },
    };
    const result = convertJiraFieldToJson(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should leave non-stringified values unchanged ', () => {
    const input = {
      fields: {
        key1: 'value1',
        key2: 123,
        key3: true,
      },
    };
    const result = convertJiraFieldToJson(input);
    expect(result).toEqual(input);
  });

  it('should handle fields object with mixed types ', () => {
    const input = {
      fields: {
        key1: 'value1',
        key2: '{"nestedKey2":"nestedValue2"}',
        key3: 123,
        key4: true,
      },
    };
    const expectedOutput = {
      fields: {
        key1: 'value1',
        key2: { nestedKey2: 'nestedValue2' },
        key3: 123,
        key4: true,
      },
    };
    const result = convertJiraFieldToJson(input);
    expect(result).toEqual(expectedOutput);
  });
});
