import React from 'react';
import { QueryRowActions, Props } from './QueryRowActions';
import { mount, shallow } from 'enzyme';

const setup = (propOverrides?: object) => {
  const props: Props = {
    isDisabled: false,
    isNotStarted: true,
    canToggleEditorModes: true,
    onClickToggleEditorMode: () => {},
    onClickToggleDisabled: () => {},
    onClickAddButton: () => {},
    onClickRemoveButton: () => {},
  };

  Object.assign(props, propOverrides);

  const mountWrapper = mount(<QueryRowActions {...props} />);
  const shallowWrapper = shallow(<QueryRowActions {...props} />);
  return { mountWrapper, shallowWrapper };
};

describe('QueryRowActions', () => {
  it('should render component', () => {
    const wrapper = setup().shallowWrapper;
    expect(wrapper).toMatchSnapshot();
  });
  it('should render component without editor mode', () => {
    const wrapper = setup({ canToggleEditorModes: false }).shallowWrapper;
    expect(wrapper.find({ 'aria-label': 'Edit mode button' })).toHaveLength(0);
  });
  it('should change icon to fa-eye-slash when query row result is hidden', () => {
    const wrapper = setup({ isDisabled: true }).mountWrapper;
    expect(wrapper.find('i.uil-eye-slash')).toHaveLength(1);
  });
  it('should change icon to fa-eye when query row result is not hidden', () => {
    const wrapper = setup({ isDisabled: false }).mountWrapper;
    expect(wrapper.find('i.uil-eye')).toHaveLength(1);
  });
});
