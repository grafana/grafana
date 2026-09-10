import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockInstanceSetttings } from '../../mocks/instanceSettings';

import { AuxiliaryLogsToggle, type Props } from './AuxiliaryLogsToggle';

const mockInstanceSettings = createMockInstanceSetttings();

const defaultProps: Props = {
  options: mockInstanceSettings.jsonData,
  onAuxiliaryLogsEnabledChange: jest.fn(),
};

describe('AuxiliaryLogsToggle', () => {
  it('should render component', () => {
    render(<AuxiliaryLogsToggle {...defaultProps} />);

    expect(screen.getByText('Enable Auxiliary Logs')).toBeInTheDocument();
  });

  it('should show warning about no SLAs', () => {
    render(<AuxiliaryLogsToggle {...defaultProps} />);

    expect(screen.getByText(/no response time SLAs/)).toBeInTheDocument();
  });

  it('should enable Auxiliary Logs when the switch is clicked', async () => {
    const onAuxiliaryLogsEnabledChange = jest.fn();
    render(<AuxiliaryLogsToggle {...defaultProps} onAuxiliaryLogsEnabledChange={onAuxiliaryLogsEnabledChange} />);

    await userEvent.click(screen.getByLabelText('Auxiliary Logs'));

    expect(onAuxiliaryLogsEnabledChange).toHaveBeenCalledWith(true);
  });
});
