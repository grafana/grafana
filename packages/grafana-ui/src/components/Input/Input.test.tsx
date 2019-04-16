import React from 'react';
import renderer from 'react-test-renderer';
import { shallow } from 'enzyme';
import { Input } from './Input';
import { EventsWithValidation } from '../../utils';
import { ValidationEvents } from '../../types';

const TEST_ERROR_MESSAGE = 'Value must be empty or less than 3 chars';
const testBlurValidation: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: (value: string) => {
        return !value || value.length < 3;
      },
      errorMessage: TEST_ERROR_MESSAGE,
    },
  ],
};

describe('Input', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<Input />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('should validate with error onBlur', () => {
    const wrapper = shallow(<Input validationEvents={testBlurValidation} />);
    const evt = {
      persist: jest.fn,
      target: {
        value: 'I can not be more than 2 chars',
      },
    };

    wrapper.find('input').simulate('blur', evt);
    expect(wrapper.state('error')).toBe(TEST_ERROR_MESSAGE);
  });

  it('should validate without error onBlur', () => {
    const wrapper = shallow(<Input validationEvents={testBlurValidation} />);
    const evt = {
      persist: jest.fn,
      target: {
        value: 'Hi',
      },
    };

    wrapper.find('input').simulate('blur', evt);
    expect(wrapper.state('error')).toBe(null);
  });
});
