import React from 'react';
import { QueryRowActions, Props } from './QueryRowActions';
import { shallow } from 'enzyme';

const setup = (propOverrides?: object) => {
  const props: Props = {
    isDisabled: false,
    isNotStarted: true,
    canToggleEditorModes: true,
    onClickToggleEditorMode: () => {},
    onClickToggleDisabled: () => {},
    onClickRemoveButton: () => {},
    latency: 0,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<QueryRowActions {...props} />);
  return wrapper;
};

describe('QueryRowActions', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });
  it('should render component without editor mode', () => {
    const wrapper = setup({ canToggleEditorModes: false });
    expect(wrapper.find({ 'aria-label': 'Edit mode button' })).toHaveLength(0);
  });
  it('should change icon to eye-slash when query row result is hidden', () => {
    const wrapper = setup({ isDisabled: true });
    expect(wrapper.find({ title: 'Enable query' })).toHaveLength(1);
  });
  it('should change icon to eye when query row result is not hidden', () => {
    const wrapper = setup({ isDisabled: false });
    expect(wrapper.find({ title: 'Disable query' })).toHaveLength(1);
  });
});
