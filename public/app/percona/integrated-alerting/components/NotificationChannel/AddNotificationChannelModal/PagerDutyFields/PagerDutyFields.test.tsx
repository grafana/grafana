import React from 'react';
import { Form } from 'react-final-form';
import { PagerDutyFields } from './PagerDutyFields';
import { NotificationChannelType, PagerDutyKeyType } from '../../NotificationChannel.types';
import { render, screen } from '@testing-library/react';

describe('PagerDutyFields', () => {
  it('should render with routing as the default key option', () => {
    const values = { name: 'test name', type: { value: NotificationChannelType.pagerDuty, label: 'test label' } };
    render(<Form onSubmit={jest.fn()} render={() => <PagerDutyFields values={values} />} />);

    expect(screen.getAllByTestId('keyType-radio-button')).toHaveLength(2);
    expect(screen.getByTestId('routing-text-input')).toBeInTheDocument();
    expect(screen.queryByTestId('service-text-input')).not.toBeInTheDocument();
  });

  it('should render only service key input if that is the selected option', () => {
    const values = {
      name: 'test name',
      type: { value: NotificationChannelType.pagerDuty, label: 'test label' },
      keyType: PagerDutyKeyType.service,
    };
    const wrapper = render(<Form onSubmit={jest.fn()} render={() => <PagerDutyFields values={values} />} />);
    const keyTypeRadioButtons = wrapper.getAllByTestId('keyType-radio-button');
    const serviceKeyTypeButton = keyTypeRadioButtons[1];

    expect(serviceKeyTypeButton).toBeChecked();
    expect(screen.getByTestId('service-text-input')).toBeInTheDocument();
  });
});
