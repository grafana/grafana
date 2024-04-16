import { NotifierDTO } from 'app/types';

import { GrafanaChannelValues, ReceiverFormValues } from '../types/receiver-form';

import {
  formValuesToGrafanaReceiver,
  omitEmptyValues,
  omitEmptyUnlessExisting,
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
          doubleNested: {
            __id: '2',
            url: 'example.com',
          },
        },
      };

      const expected = {
        foo: 'bar',
        nested: {
          baz: 'qux',
          doubleNested: {
            url: 'example.com',
          },
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
