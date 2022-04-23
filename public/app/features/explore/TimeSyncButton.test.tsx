import { mount } from 'enzyme';
import React from 'react';

import { TimeSyncButton } from './TimeSyncButton';

const setup = (isSynced: boolean) => {
  const onClick = () => {};
  return mount(<TimeSyncButton onClick={onClick} isSynced={isSynced} />);
};

describe('TimeSyncButton', () => {
  it('should change style when synced', () => {
    const wrapper = setup(true);
    expect(wrapper.find('button').props()['aria-label']).toEqual('Synced times');
  });
  it('should not change style when not synced', () => {
    const wrapper = setup(false);
    expect(wrapper.find('button').props()['aria-label']).toEqual('Unsynced times');
  });
});
