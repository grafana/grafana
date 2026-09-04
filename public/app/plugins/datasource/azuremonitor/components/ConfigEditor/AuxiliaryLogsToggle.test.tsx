import { render, screen } from '@testing-library/react';

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
});
