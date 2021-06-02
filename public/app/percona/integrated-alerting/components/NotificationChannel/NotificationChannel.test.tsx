import React from 'react';
import { dataQa } from '@percona/platform-core';
import { NotificationChannel } from './NotificationChannel';
import { DeleteNotificationChannelModal } from './DeleteNotificationChannelModal/DeleteNotificationChannelModal';
import { getMount } from 'app/percona/shared/helpers/testUtils';

jest.mock('./NotificationChannel.service');

describe('NotificationChannel', () => {
  it('should render table correctly', async () => {
    const wrapper = await getMount(<NotificationChannel />);

    wrapper.update();

    expect(wrapper.find(dataQa('table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataQa('table-tbody')).find('tr')).toHaveLength(3);
    expect(wrapper.find(dataQa('table-no-data'))).toHaveLength(0);
  });

  it('should render add modal', async () => {
    const wrapper = await getMount(<NotificationChannel />);

    expect(wrapper.contains(dataQa('modal-wrapper'))).toBeFalsy();

    wrapper
      .find(dataQa('notification-channel-add-modal-button'))
      .find('button')
      .simulate('click');

    expect(wrapper.find(dataQa('modal-wrapper'))).toBeTruthy();
  });

  it('should render delete modal', async () => {
    const wrapper = await getMount(<NotificationChannel />);

    expect(wrapper.find(DeleteNotificationChannelModal).length).toBe(1);
  });
});
