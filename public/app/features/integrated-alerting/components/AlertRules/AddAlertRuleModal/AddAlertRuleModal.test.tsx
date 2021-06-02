import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { AddAlertRuleModal } from './AddAlertRuleModal';
import { AlertRule } from '../AlertRules.types';
import { templateStubs } from '../../AlertRuleTemplate/__mocks__/alertRuleTemplateStubs';
import { SEVERITY_OPTIONS } from './AddAlertRulesModal.constants';

jest.mock('../AlertRules.service');
jest.mock('../../AlertRuleTemplate/AlertRuleTemplate.service');
jest.mock('../../NotificationChannel/NotificationChannel.service');

jest.mock('app/core/app_events', () => {
  return {
    appEvents: {
      emit: jest.fn(),
    },
  };
});

const selectTemplateOption = (wrapper: ReactWrapper, templateIndex = 0) => {
  wrapper
    .find('input')
    .first()
    .simulate('keydown', { key: 'ArrowDown' });
  wrapper
    .find({ 'aria-label': 'Select option' })
    .at(templateIndex)
    .simulate('click');
};

describe('AddAlertRuleModal', () => {
  const {
    name: templateName,
    summary: templateSummary,
    params: templateParams = [],
    yaml: templateYaml,
  } = templateStubs[0];
  const initialValues: AlertRule = {
    ruleId: '/rule_id/ded33d30-1b65-4b43-ba45-75ca52b48fa5',
    createdAt: '2021-01-19 12:53:16.082',
    duration: '3600s',
    filters: [],
    severity: 'Critical',
    summary: 'Just a summary',
    lastNotified: '',
    disabled: false,
    expr: '',
    params: templateParams.map(({ name, type, unit, summary }) => ({ name, type, summary, unit, value: 10 })),
    rawValues: {
      channels: [],
      filters: [],
      disabled: false,
      expr: '',
      template: {
        name: templateName,
        summary: templateSummary,
        params: templateParams,
        yaml: templateYaml,
      },
      rule_id: '/rule_id/ded33d30-1b65-4b43-ba45-75ca52b48fa5',
      summary: 'Just a summary',
      params: [],
      for: '3600s',
      severity: 'SEVERITY_CRITICAL',
      created_at: '2021-01-19T12:53:16.082610Z',
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper.find(dataQa('add-alert-rule-modal')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('add-alert-rule-modal-add-button')).exists()).toBeTruthy();
  });

  it('does not render the modal when visible is set to false', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible={false} />);
    });

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(0);
  });

  it('renders the modal when visible is set to true', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    });

    expect(wrapper.find(dataQa('add-alert-rule-modal-form')).length).toBe(1);
  });

  it('should have the submit button disabled by default when adding a new rule', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    });
    const button = wrapper.find(dataQa('add-alert-rule-modal-add-button')).find('button');

    expect(button.props().disabled).toBe(true);
  });

  it('should enable the submit button if all fields are valid', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />);
    });

    wrapper.update();

    const thresholdInput = wrapper.find(dataQa(`${templateParams[0].name}-number-input`));
    thresholdInput.simulate('change', {
      target: {
        value: '2',
      },
    });
    const button = wrapper.find(dataQa('add-alert-rule-modal-add-button')).find('button');

    expect(button.props().disabled).toBe(false);
  });

  it('should disable the submit button if a negative duration is inserted', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />);
    });

    wrapper.update();
    const thresholdInput = wrapper.find(dataQa(`${templateParams[0].name}-number-input`));
    const durationInput = wrapper.find(dataQa('duration-number-input'));

    thresholdInput.simulate('change', {
      target: {
        value: '2',
      },
    });

    durationInput.simulate('change', {
      target: {
        value: '-10',
      },
    });
    const button = wrapper.find(dataQa('add-alert-rule-modal-add-button')).find('button');

    expect(button.props().disabled).toBe(true);
  });

  it('should disable template edition', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />);
    });
    wrapper.update();

    expect(
      wrapper
        .find(dataQa('template-select-input'))
        .first()
        .prop('disabled')
    ).toBeTruthy();
  });

  it('should change params when switching templates', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('template-1-threshold-number-input')).exists()).toBeFalsy();

    selectTemplateOption(wrapper);

    expect(wrapper.find(dataQa('template-1-threshold-number-input')).exists()).toBeTruthy();

    selectTemplateOption(wrapper, 3);

    expect(wrapper.find(dataQa('template-1-threshold-number-input')).exists()).toBeFalsy();
    expect(wrapper.find(dataQa('template-4-from-number-input')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('template-4-to-number-input')).exists()).toBeTruthy();
  });

  it('should pre-fill severity and duration when switching templates', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('duration-number-input')).text()).toHaveLength(0);
    expect(
      wrapper
        .find(dataQa('severity-multiselect-input'))
        .first()
        .text()
    ).toBe('Choose');

    selectTemplateOption(wrapper);

    expect(wrapper.find(dataQa('duration-number-input')).props().value).toBe(parseInt(templateStubs[0].for, 10));
    expect(
      wrapper
        .find(dataQa('severity-multiselect-input'))
        .first()
        .text()
    ).toBe(SEVERITY_OPTIONS.find(severity => severity.value === templateStubs[0].severity)?.label);
  });

  it('should show the expression and sample alert when switching templates', async () => {
    let wrapper: ReactWrapper;

    await act(async () => {
      wrapper = mount(<AddAlertRuleModal setVisible={jest.fn()} isVisible />);
    });

    wrapper.update();

    expect(wrapper.find(dataQa('template-expression')).exists()).toBeFalsy();
    expect(wrapper.find(dataQa('template-alert')).exists()).toBeFalsy();

    selectTemplateOption(wrapper);

    expect(
      wrapper
        .find(dataQa('template-expression'))
        .find('pre')
        .text()
    ).toBe(templateStubs[0].expr);
    expect(
      wrapper
        .find(dataQa('template-alert'))
        .find('pre')
        .text()
    ).toBe(templateStubs[0].annotations?.summary);
  });
});
