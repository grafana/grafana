import React from 'react';
import { TimeSyncButton } from './TimeSyncButton';
import { mount } from 'enzyme';

const setup = (isSynced: boolean = true) => {
  const onClick = () => {};
  return mount(<TimeSyncButton onClick={onClick} isSynced={isSynced} />);
};

describe('TimeSyncButton', () => {
  it('should render component', () => {
    const wrapper = setup(true);
    expect(wrapper).toMatchSnapshot();
  });
  it('should change style when synced', () => {
    const wrapper = setup(true);
    expect(wrapper.find('button').hasClass('css-14r9fpj-timePickerSynced')).toEqual(true);
  });
  it('should not change style when not synced', () => {
    const wrapper = setup(false);
    expect(wrapper.find('button').hasClass('css-14r9fpj-timePickerSynced')).toEqual(false);
  });
});
