import React from 'react';
import { TimeSyncButton } from './TimeSyncButton';
import { mount } from 'enzyme';

const setup = (isSynced: boolean) => {
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
    expect(wrapper.find('button').props()['aria-label']).toEqual('Synced times');
  });
  it('should not change style when not synced', () => {
    const wrapper = setup(false);
    expect(wrapper.find('button').props()['aria-label']).toEqual('Unsynced times');
  });
});
