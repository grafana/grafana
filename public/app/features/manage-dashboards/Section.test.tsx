import React from 'react';
import { shallow } from 'enzyme';
import { Props, Section } from './Section';
import { getMockSection, getMockSectionItems } from './__mocks__/manageDashboardMock';

const setup = (propOverrides?: object) => {
  const props: Props = {
    section: getMockSection(),
    loadSectionItems: jest.fn(),
    collapseSection: jest.fn(),
    setSectionSelected: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<Section {...props} />);
  const instance = wrapper.instance() as Section;

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

  it('should render items', () => {
    const { wrapper } = setup({
      section: {
        ...getMockSection(),
        items: getMockSectionItems(5),
        expanded: true,
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  describe('Toggle folder expand', () => {
    it('should expand folder', () => {
      const { instance } = setup();

      instance.toggleFolder();

      expect(instance.props.loadSectionItems).toHaveBeenCalled();
    });

    it('should collapse folder', () => {
      const { instance } = setup({ section: { ...getMockSection(), expanded: true } });

      instance.toggleFolder();

      expect(instance.props.collapseSection).toHaveBeenCalled();
    });
  });
});
