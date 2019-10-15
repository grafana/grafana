import React from 'react';
import { TimeSyncButton } from './TimeSyncButton';
import { mount } from 'enzyme';

const setup = (isSynced: boolean) => {
  const onClick = () => {};
  return mount(<TimeSyncButton onClick={onClick} isSynced={isSynced} />);
};

describe('TimeSyncButton', () => {
  it('should change style when synced', () => {
    expect(
      setup(true)
        .find('button')
        .hasClass('css-14r9fpj-timePickerSynced')
    ).toEqual(true);
  });
  it('should not change style when not synced', () => {
    expect(
      setup(false)
        .find('button')
        .hasClass('css-14r9fpj-timePickerSynced')
    ).toEqual(false);
  });
});
