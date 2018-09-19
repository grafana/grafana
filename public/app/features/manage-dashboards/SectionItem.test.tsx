import React from 'react';
import { shallow } from 'enzyme';
import { Props, SectionItem } from './SectionItem';
import { getMockSectionItems } from './__mocks__/manageDashboardMock';

const setup = (propOverrides?: object) => {
  const props: Props = {
    item: getMockSectionItems(1)[0],
    addTagFilter: jest.fn(),
    updateLocation: jest.fn(),
    setSectionItemSelected: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<SectionItem {...props} />);
  const instance = wrapper.instance() as SectionItem;

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
});
