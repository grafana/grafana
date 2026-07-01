import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockInstanceSetttings } from '../../mocks/instanceSettings';

import { BatchAPIToggle, type Props } from './BatchAPIToggle';

const mockInstanceSettings = createMockInstanceSetttings();

const defaultProps: Props = {
  options: mockInstanceSettings.jsonData,
  onBatchAPIEnabledChange: jest.fn(),
};

describe('BatchAPIToggle', () => {
  it('renders unchecked by default', () => {
    render(<BatchAPIToggle {...defaultProps} options={{ ...defaultProps.options, batchAPIEnabled: undefined }} />);

    expect(screen.getByText('Enable Batch API')).toBeInTheDocument();
    expect(screen.getByLabelText('Batch API')).not.toBeChecked();
  });

  it('calls onBatchAPIEnabledChange when toggled on', async () => {
    const onBatchAPIEnabledChange = jest.fn();
    render(
      <BatchAPIToggle
        {...defaultProps}
        options={{ ...defaultProps.options, batchAPIEnabled: false }}
        onBatchAPIEnabledChange={onBatchAPIEnabledChange}
      />
    );

    await userEvent.click(screen.getByLabelText('Batch API'));

    expect(onBatchAPIEnabledChange).toHaveBeenCalledWith(true);
  });
});
