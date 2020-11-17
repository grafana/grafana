import React from 'react';
import { shallow } from 'enzyme';
import IntegratedAlertingPage from './IntegratedAlertingPage';

describe('IntegratedAlertingPage', () => {
  it('Should render passed chidren correctly', () => {
    const wrapper = shallow(
      <IntegratedAlertingPage>
        <span>test</span>
      </IntegratedAlertingPage>
    );

    expect(wrapper.find('span')).toHaveLength(1);
    expect(wrapper.find('span').text()).toEqual('test');
  });
});
