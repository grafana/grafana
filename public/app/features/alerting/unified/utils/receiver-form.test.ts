import { NotifierDTO } from 'app/types';

import { GrafanaChannelValues, ReceiverFormValues } from '../types/receiver-form';

import { formValuesToGrafanaReceiver, omitEmptyValues, omitEmptyUnlessExisting } from './receiver-form';

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
});

describe('formValuesToGrafanaReceiver', () => {
  it('should migrate regular settings to secure settings if the field is defined as secure', () => {
    const formValues: ReceiverFormValues<GrafanaChannelValues> = {
      name: 'my-receiver',
      items: [
        {
          __id: '1',
          secureSettings: {},
          secureFields: {},
          type: 'discord',
          settings: {
            url: 'https://foo.bar/',
          },
          disableResolveMessage: false,
        },
      ],
    };

    const channelMap = {
      '1': {
        uid: 'abc123',
        secureSettings: {},
        secureFields: {},
        type: 'discord',
        settings: {
          url: 'https://foo.bar/',
        },
        disableResolveMessage: false,
      },
    };

    const notifiers = [
      {
        type: 'discord',
        options: [{ propertyName: 'url', secure: true }],
      },
    ] as NotifierDTO[];

    // @ts-expect-error
    expect(formValuesToGrafanaReceiver(formValues, channelMap, {}, notifiers)).toMatchSnapshot();
  });
});
