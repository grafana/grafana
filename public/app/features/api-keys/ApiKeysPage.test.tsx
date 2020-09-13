import React from 'react';
import { shallow } from 'enzyme';
import { ApiKeysPage, Props } from './ApiKeysPage';
import { ApiKey } from 'app/types';
import { getMockKey, getMultipleMockKeys } from './__mocks__/apiKeysMock';
import { NavModel } from '@grafana/data';
import { setSearchQuery } from './state/reducers';
import { mockToolkitActionCreator } from '../../../test/core/redux/mocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Api Keys',
      },
    } as NavModel,
    apiKeys: [] as ApiKey[],
    searchQuery: '',
    hasFetched: false,
    loadApiKeys: jest.fn(),
    deleteApiKey: jest.fn(),
    setSearchQuery: mockToolkitActionCreator(setSearchQuery),
    addApiKey: jest.fn(),
    apiKeysCount: 0,
    includeExpired: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<ApiKeysPage {...props} />);
  const instance = wrapper.instance() as ApiKeysPage;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render API keys table if there are any keys', () => {
    const { wrapper } = setup({
      apiKeys: getMultipleMockKeys(5),
      apiKeysCount: 5,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render CTA if there are no API keys', () => {
    const { wrapper } = setup({
      apiKeys: getMultipleMockKeys(0),
      apiKeysCount: 0,
      hasFetched: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Life cycle', () => {
  it('should call loadApiKeys', () => {
    const { instance } = setup();

    instance.componentDidMount();

    expect(instance.props.loadApiKeys).toHaveBeenCalledWith(false);
  });
});

describe('Functions', () => {
  describe('Delete team', () => {
    it('should call delete team', () => {
      const { instance } = setup();
      instance.onDeleteApiKey(getMockKey());
      expect(instance.props.deleteApiKey).toHaveBeenCalledWith(1, false);
    });
  });

  describe('on search query change', () => {
    it('should call setSearchQuery', () => {
      const { instance } = setup();

      instance.onSearchQueryChange('test');

      expect(instance.props.setSearchQuery).toHaveBeenCalledWith('test');
    });
  });
});
