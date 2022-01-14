import React from 'react';
import { dataTestId } from '@percona/platform-core';
import { getMount } from 'app/percona/shared/helpers/testUtils';
import { Alerts } from './Alerts';
import { AlertsService } from './Alerts.service';

jest.mock('./Alerts.service');

describe('AlertsTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table correctly', async () => {
    const wrapper = await getMount(<Alerts />);

    wrapper.update();

    expect(wrapper.find(dataTestId('table-thead')).find('tr')).toHaveLength(1);
    expect(wrapper.find(dataTestId('table-tbody')).find('tr')).toHaveLength(6);
    expect(wrapper.find(dataTestId('table-no-data'))).toHaveLength(0);
  });

  it('should have table initially loading', async () => {
    const wrapper = await getMount(<Alerts />);

    expect(wrapper.find(dataTestId('table-loading')).exists()).toBeTruthy();
  });

  it('should render correctly without data', async () => {
    jest
      .spyOn(AlertsService, 'list')
      .mockReturnValueOnce(Promise.resolve({ alerts: [], totals: { total_items: 0, total_pages: 1 } }));
    const wrapper = await getMount(<Alerts />);

    wrapper.update();

    expect(wrapper.find(dataTestId('table-thead')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataTestId('table-tbody')).find('tr')).toHaveLength(0);
    expect(wrapper.find(dataTestId('table-no-data'))).toHaveLength(1);
  });
});
