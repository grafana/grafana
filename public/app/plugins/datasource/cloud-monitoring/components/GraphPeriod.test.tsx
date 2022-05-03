import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { GraphPeriod, Props } from './GraphPeriod';

const props: Props = {
  onChange: jest.fn(),
  refId: 'A',
};

describe('Graph Period', () => {
  it('should enable graph_period by default', () => {
    render(<GraphPeriod {...props} />);
    expect(screen.getByLabelText('Graph period')).not.toBeDisabled();
  });

  it('should disable graph_period', async () => {
    const onChange = jest.fn();
    render(<GraphPeriod {...props} onChange={onChange} />);
    const s = screen.getByTestId('A-switch-graph-period');
    await userEvent.click(s);
    expect(onChange).toHaveBeenCalledWith('disabled');
  });

  it('should set a different value', async () => {
    const onChange = jest.fn();
    render(<GraphPeriod {...props} onChange={onChange} />);
    const s = screen.getByLabelText('Graph period');
    await userEvent.type(s, '1s');
    expect(onChange).toHaveBeenCalledWith('1s');
  });
});
