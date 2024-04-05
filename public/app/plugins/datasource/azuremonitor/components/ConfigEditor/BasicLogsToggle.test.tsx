import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createMockInstanceSetttings } from '../../__mocks__/instanceSettings';
import { selectors } from '../../e2e/selectors';

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
