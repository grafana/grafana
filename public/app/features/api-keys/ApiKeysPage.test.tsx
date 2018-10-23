import React from 'react';
import { shallow } from 'enzyme';
import { Props, ApiKeysPage } from './ApiKeysPage';
import { NavModel, ApiKey } from 'app/types';
import { getMultipleMockKeys, getMockKey } from './__mocks__/apiKeysMock';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    apiKeys: [] as ApiKey[],
    searchQuery: '',
    hasFetched: false,
    loadApiKeys: jest.fn(),
    deleteApiKey: jest.fn(),
    setSearchQuery: jest.fn(),
    addApiKey: jest.fn(),
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
  it('should render component', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });

  it('should render API keys table', () => {
    const { wrapper } = setup({
      apiKeys: getMultipleMockKeys(5),
      hasFetched: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Life cycle', () => {
  it('should call loadApiKeys', () => {
    const { instance } = setup();

    instance.componentDidMount();

    expect(instance.props.loadApiKeys).toHaveBeenCalled();
  });
});

describe('Functions', () => {
  describe('Delete team', () => {
    it('should call delete team', () => {
      const { instance } = setup();
      instance.onDeleteApiKey(getMockKey());
      expect(instance.props.deleteApiKey).toHaveBeenCalledWith(1);
    });
  });

  describe('on search query change', () => {
    it('should call setSearchQuery', () => {
      const { instance } = setup();
      const mockEvent = { target: { value: 'test' } };

      instance.onSearchQueryChange(mockEvent);

      expect(instance.props.setSearchQuery).toHaveBeenCalledWith('test');
    });
  });
});
