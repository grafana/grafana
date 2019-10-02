import React from 'react';
import { mount, shallow } from 'enzyme';
import { DataSourceApi } from '@grafana/ui';

import { AdHocFilterField, DEFAULT_REMOVE_FILTER_VALUE, KeyValuePair, Props } from './AdHocFilterField';
import { AdHocFilter } from './AdHocFilter';
import { MockDataSourceApi } from '../../../test/mocks/datasource_srv';

describe('<AdHocFilterField />', () => {
  let mockDataSourceApi: DataSourceApi;

  beforeEach(() => {
    mockDataSourceApi = new MockDataSourceApi();
  });

  it('should initially have no filters', () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);
    expect(wrapper.find(AdHocFilter).exists()).toBeFalsy();
  });

  it('should add <AdHocFilter /> when onAddFilter is invoked', async () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    const asyncCheck = setImmediate(() => {
      expect(wrapper.find(AdHocFilter).exists()).toBeTruthy();
    });
    global.clearImmediate(asyncCheck);
  });

  it(`should remove the relevant filter when the '${DEFAULT_REMOVE_FILTER_VALUE}' key is selected`, () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);

    wrapper
      .find('button')
      .first()
      .simulate('click');
    const asyncCheck = setImmediate(() => {
      expect(wrapper.find(AdHocFilter).exists()).toBeTruthy();

      wrapper.find(AdHocFilter).prop('onKeyChanged')(DEFAULT_REMOVE_FILTER_VALUE);
      expect(wrapper.find(AdHocFilter).exists()).toBeFalsy();
    });
    global.clearImmediate(asyncCheck);
  });

  it('it should call onPairsChanged when a filter is removed', async () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);

    wrapper
      .find('button')
      .first()
      .simulate('click');
    const asyncCheck = setImmediate(() => {
      expect(wrapper.find(AdHocFilter).exists()).toBeTruthy();

      wrapper.find(AdHocFilter).prop('onKeyChanged')(DEFAULT_REMOVE_FILTER_VALUE);
      expect(wrapper.find(AdHocFilter).exists()).toBeFalsy();

      expect(mockOnPairsChanged.mock.calls.length).toBe(1);
    });
    global.clearImmediate(asyncCheck);
  });
});

const setup = (propOverrides?: Partial<Props>) => {
  const datasource: DataSourceApi<any, any> = ({
    getTagKeys: jest.fn().mockReturnValue([{ text: 'key 1' }, { text: 'key 2' }]),
    getTagValues: jest.fn().mockReturnValue([{ text: 'value 1' }, { text: 'value 2' }]),
  } as unknown) as DataSourceApi<any, any>;

  const props: Props = {
    datasource,
    onPairsChanged: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<AdHocFilterField {...props} />);
  const instance = wrapper.instance() as AdHocFilterField;

  return {
    instance,
    wrapper,
    datasource,
  };
};

describe('AdHocFilterField', () => {
  describe('loadTagKeys', () => {
    describe('when called and there is no extendedOptions', () => {
      const { instance, datasource } = setup({ extendedOptions: undefined });

      it('then it should return correct keys', async () => {
        const keys = await instance.loadTagKeys();

        expect(keys).toEqual(['key 1', 'key 2']);
      });

      it('then datasource.getTagKeys should be called with an empty object', async () => {
        await instance.loadTagKeys();

        expect(datasource.getTagKeys).toBeCalledWith({});
      });
    });

    describe('when called and there is extendedOptions', () => {
      const extendedOptions = { measurement: 'default' };
      const { instance, datasource } = setup({ extendedOptions });

      it('then it should return correct keys', async () => {
        const keys = await instance.loadTagKeys();

        expect(keys).toEqual(['key 1', 'key 2']);
      });

      it('then datasource.getTagKeys should be called with extendedOptions', async () => {
        await instance.loadTagKeys();

        expect(datasource.getTagKeys).toBeCalledWith(extendedOptions);
      });
    });
  });

  describe('loadTagValues', () => {
    describe('when called and there is no extendedOptions', () => {
      const { instance, datasource } = setup({ extendedOptions: undefined });

      it('then it should return correct values', async () => {
        const values = await instance.loadTagValues('key 1');

        expect(values).toEqual(['value 1', 'value 2']);
      });

      it('then datasource.getTagValues should be called with the correct key', async () => {
        await instance.loadTagValues('key 1');

        expect(datasource.getTagValues).toBeCalledWith({ key: 'key 1' });
      });
    });

    describe('when called and there is extendedOptions', () => {
      const extendedOptions = { measurement: 'default' };
      const { instance, datasource } = setup({ extendedOptions });

      it('then it should return correct values', async () => {
        const values = await instance.loadTagValues('key 1');

        expect(values).toEqual(['value 1', 'value 2']);
      });

      it('then datasource.getTagValues should be called with extendedOptions and the correct key', async () => {
        await instance.loadTagValues('key 1');

        expect(datasource.getTagValues).toBeCalledWith({ measurement: 'default', key: 'key 1' });
      });
    });
  });

  describe('updatePairs', () => {
    describe('when called with an empty pairs array', () => {
      describe('and called with keys', () => {
        it('then it should return correct pairs', async () => {
          const { instance } = setup();
          const pairs: KeyValuePair[] = [];
          const index = 0;
          const key: string = undefined;
          const keys: string[] = ['key 1', 'key 2'];
          const value: string = undefined;
          const values: string[] = undefined;
          const operator: string = undefined;

          const result = instance.updatePairs(pairs, index, { key, keys, value, values, operator });

          expect(result).toEqual([{ key: '', keys, value: '', values: [], operator: '' }]);
        });
      });
    });

    describe('when called with an non empty pairs array', () => {
      it('then it should update correct pairs at supplied index', async () => {
        const { instance } = setup();
        const pairs: KeyValuePair[] = [
          {
            key: 'prev key 1',
            keys: ['prev key 1', 'prev key 2'],
            value: 'prev value 1',
            values: ['prev value 1', 'prev value 2'],
            operator: '=',
          },
          {
            key: 'prev key 3',
            keys: ['prev key 3', 'prev key 4'],
            value: 'prev value 3',
            values: ['prev value 3', 'prev value 4'],
            operator: '!=',
          },
        ];
        const index = 1;
        const key = 'key 3';
        const keys = ['key 3', 'key 4'];
        const value = 'value 3';
        const values = ['value 3', 'value 4'];
        const operator = '=';

        const result = instance.updatePairs(pairs, index, { key, keys, value, values, operator });

        expect(result).toEqual([
          {
            key: 'prev key 1',
            keys: ['prev key 1', 'prev key 2'],
            value: 'prev value 1',
            values: ['prev value 1', 'prev value 2'],
            operator: '=',
          },
          {
            key: 'key 3',
            keys: ['key 3', 'key 4'],
            value: 'value 3',
            values: ['value 3', 'value 4'],
            operator: '=',
          },
        ]);
      });
    });
  });
});
