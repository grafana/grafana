import React from 'react';
import { shallow } from 'enzyme';
import BasicSettings, { Props } from './BasicSettings';

const setup = () => {
  const props: Props = {
    dataSource: {} as any,
    dataSourceName: 'Graphite',
    isDefault: false,
    onDefaultChange: jest.fn(),
    onNameChange: jest.fn(),
    libraryCredentials: [],
    updateDataSource: {} as any,
  };

  return shallow(<BasicSettings {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
