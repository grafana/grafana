import { render, screen } from '@testing-library/react';

import { createMockInstanceSetttings } from '../../mocks/instanceSettings';

import { BasicLogsToggle, Props } from './BasicLogsToggle';

const mockInstanceSettings = createMockInstanceSetttings();

const defaultProps: Props = {
  options: mockInstanceSettings.jsonData,
  onBasicLogsEnabledChange: jest.fn(),
};

describe('BasicLogsToggle', () => {
  it('should render component', () => {
    render(<BasicLogsToggle {...defaultProps} />);

    expect(screen.getByText('Enable Basic Logs')).toBeInTheDocument();
  });
});
