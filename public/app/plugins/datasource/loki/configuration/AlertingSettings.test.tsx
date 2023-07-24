import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createDefaultConfigOptions } from '../mocks';

import { AlertingSettings } from './AlertingSettings';

const options = createDefaultConfigOptions();

describe('AlertingSettings', () => {
  it('should render', () => {
    render(<AlertingSettings options={options} onOptionsChange={() => {}} />);
    expect(screen.getByText('Alerting')).toBeInTheDocument();
  });

  it('should update alerting settings', async () => {
    const onChange = jest.fn();
    render(<AlertingSettings options={options} onOptionsChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Toggle switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
