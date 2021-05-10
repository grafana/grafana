import React from 'react';
import { shallow } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { DataModel } from 'app/percona/backup/Backup.types';
import { DetailedDate } from '../../DetailedDate';
import { RestoreHistoryDetails } from './RestoreHistoryDetails';

const FINISHED_DATE = 1615912580244;
describe('RestoreHistoryDetails', () => {
  it('should render', () => {
    const wrapper = shallow(
      <RestoreHistoryDetails name="restore one" finished={FINISHED_DATE} dataModel={DataModel.PHYSICAL} />
    );
    expect(wrapper.find(dataQa('restore-details-wrapper')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('restore-details-name')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('restore-details-finished')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('restore-details-data-model')).exists()).toBeTruthy();
    expect(wrapper.find(DetailedDate).exists()).toBeTruthy();
  });

  it('should hide "finished at" when null', () => {
    const wrapper = shallow(
      <RestoreHistoryDetails name="restore one" finished={null} dataModel={DataModel.PHYSICAL} />
    );
    expect(wrapper.find(dataQa('restore-details-finished')).exists()).toBeFalsy();
  });
});
