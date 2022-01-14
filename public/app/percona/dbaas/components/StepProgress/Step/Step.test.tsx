import React from 'react';
import { shallow } from 'enzyme';
import { Step, StepStatus } from './Step';

describe('Step::', () => {
  it('renders step header correctly with title and number', () => {
    const wrapper = shallow(
      <Step title="Test title" number={2} onClick={() => {}}>
        Test content
      </Step>
    );
    const header = wrapper.find('[data-testid="step-header"]');
    const number = header.find('div').at(1);
    const title = wrapper.find('div').at(3);

    expect(number.text()).toEqual('2');
    expect(title.text()).toEqual('Test title');
  });
  it('renders step header correctly without title and number', () => {
    const wrapper = shallow(<Step onClick={() => {}}>Test content</Step>);
    const header = wrapper.find('[data-testid="step-header"]');
    const number = header.find('div').at(1);
    const title = wrapper.find('div').at(3);

    expect(number.text()).toEqual('');
    expect(title.text()).toEqual('');
  });
  it('renders checkmark when step is done', () => {
    const wrapper = shallow(
      <Step status={StepStatus.done} onClick={() => {}}>
        Test content
      </Step>
    );
    const header = wrapper.find('[data-testid="step-header"]');

    expect(header.find('svg')).toBeTruthy();
  });
  it('renders step content correctly', () => {
    const wrapper = shallow(<Step onClick={() => {}}>Test content</Step>);
    const contentWrapper = wrapper.find('div').at(6);

    expect(contentWrapper.text()).toContain('Test content');
  });
  it('calls step action', () => {
    const action = jest.fn();
    const wrapper = shallow(<Step onClick={action}>Test content</Step>);
    const header = wrapper.find('[data-testid="step-header"]');

    header.simulate('click');

    expect(action).toHaveBeenCalled();
  });
});
