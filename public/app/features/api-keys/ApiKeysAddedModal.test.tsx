import React from 'react';
import { shallow } from 'enzyme';
import { ApiKeysAddedModal, Props } from './ApiKeysAddedModal';

const setup = (propOverrides?: object) => {
  const props: Props = {
    apiKey: 'api key test',
    rootPath: 'test/path',
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<ApiKeysAddedModal {...props} />);

  return {
    wrapper,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
