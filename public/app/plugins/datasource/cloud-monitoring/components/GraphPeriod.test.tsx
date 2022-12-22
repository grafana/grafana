import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { select } from 'react-select-event';

import { GraphPeriod, Props } from './GraphPeriod';

const props: Props = {
  onChange: jest.fn(),
  refId: 'A',
  variableOptionGroup: { options: [] },
};

describe('Graph Period', () => {
  it('should enable graph_period by default', () => {
    render(<GraphPeriod {...props} />);
    expect(screen.getByLabelText('Graph period')).not.toBeDisabled();
  });

  it('should disable graph_period when toggled', async () => {
    const onChange = jest.fn();
    render(<GraphPeriod {...props} onChange={onChange} />);
    const s = screen.getByTestId('A-switch-graph-period');
    await userEvent.click(s);
    expect(onChange).toHaveBeenCalledWith('disabled');
  });

  it('should set a different value when selected', async () => {
    const onChange = jest.fn();
    render(<GraphPeriod {...props} onChange={onChange} />);
    const selectEl = screen.getByLabelText('Graph period');
    expect(selectEl).toBeInTheDocument();

    await select(selectEl, '1m', {
      container: document.body,
    });
    expect(onChange).toHaveBeenCalledWith('1m');
  });
});
