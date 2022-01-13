import { dataQa } from '@percona/platform-core';
import { mount, shallow, ReactWrapper, ShallowWrapper } from 'enzyme';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { DeleteNotificationChannelModal } from './DeleteNotificationChannelModal/DeleteNotificationChannelModal';
import { NotificationChannel } from './NotificationChannel';

jest.mock('./NotificationChannel.service');

describe('NotificationChannel', () => {
  it('should render table correctly', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<NotificationChannel />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(3);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
  });

  it('should render add modal', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<NotificationChannel />);
    });

    expect(wrapper.contains(dataQa('modal-wrapper'))).toBeFalsy();

    wrapper.find(dataQa('notification-channel-add-modal-button')).find('button').simulate('click');

    expect(wrapper.find(dataQa('modal-wrapper'))).toBeTruthy();
  });

  it('should render delete modal', async () => {
    let wrapper: ShallowWrapper;

    await act(async () => {
      wrapper = shallow(<NotificationChannel />);
    });

    expect(wrapper.find(DeleteNotificationChannelModal).length).toBe(1);
  });
});
