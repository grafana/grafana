import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';

describe('AddAlertRuleTemplateModal', () => {
  it('should render component correctly', () => {
    const wrapper = mount(<AddAlertRuleTemplateModal setVisible={jest.fn()} isVisible />);
    const addButton = wrapper.find(dataQa('alert-rule-template-add-button')).find('button');

    expect(wrapper.find('textarea')).toBeTruthy();
    expect(wrapper.find(dataQa('alert-rule-template-upload-button')).find('button')).toBeTruthy();
    expect(addButton).toBeTruthy();
    expect(addButton.prop('disabled')).toBeTruthy();
  });

  it('should not render modal when visible is set to false', () => {
    const wrapper = mount(<AddAlertRuleTemplateModal setVisible={jest.fn()} isVisible={false} />);

    expect(wrapper.contains('textarea')).toBeFalsy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    const wrapper = mount(<AddAlertRuleTemplateModal setVisible={setVisible} isVisible />);

    wrapper.find(dataQa('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalled();
  });
});
