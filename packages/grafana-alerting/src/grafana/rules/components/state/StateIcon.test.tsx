import userEvent from '@testing-library/user-event';

import { render, screen } from '../../../../../tests/test-utils';

import { StateIcon } from './StateIcon';

describe('StateIcon', () => {
  it('should render the icon for "normal" state', async () => {
    const user = userEvent.setup();
    render(<StateIcon state="normal" />);
    const icon = screen.getByLabelText('Normal');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Normal');
  });

  it('should render the icon for "firing" state', async () => {
    const user = userEvent.setup();
    render(<StateIcon state="firing" />);
    const icon = screen.getByLabelText('Firing');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Firing');
  });

  // Health takes precedence over state
  it('should show "Failed to evaluate rule" when health is "error", ignoring state', async () => {
    const user = userEvent.setup();
    render(<StateIcon state="normal" health="error" />);
    const icon = screen.getByLabelText('Failed to evaluate rule');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Failed to evaluate rule');
  });

  it('should show "Insufficient data" when health is "nodata", ignoring state', async () => {
    const user = userEvent.setup();
    render(<StateIcon state="firing" health="nodata" />);
    const icon = screen.getByLabelText('Insufficient data');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Insufficient data');
  });

  // isPaused takes precedence over health and state
  it('should show "Paused" when isPaused is true, ignoring health and state', async () => {
    const user = userEvent.setup();
    render(<StateIcon state="firing" health="error" isPaused />);
    const icon = screen.getByLabelText('Paused');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Paused');
  });

  // operation takes precedence over all
  it('should show "Creating" when operation is "creating", ignoring other props', async () => {
    const user = userEvent.setup();
    render(<StateIcon state="firing" health="error" isPaused operation="creating" />);
    const icon = screen.getByLabelText('Creating');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Creating');
  });

  it('should show "Deleting" when operation is "deleting", ignoring other props', async () => {
    const user = userEvent.setup();
    render(<StateIcon state="normal" operation="deleting" />);
    const icon = screen.getByLabelText('Deleting');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Deleting');
  });

  it('should show "Recording" when recording is true', async () => {
    const user = userEvent.setup();
    render(<StateIcon type="recording" />);
    const icon = screen.getByLabelText('Recording');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Recording');
  });

  it('should show "Failed to evaluate rule" when Recording health is "error"', async () => {
    const user = userEvent.setup();
    render(<StateIcon type="recording" health="error" />);
    const icon = screen.getByLabelText('Failed to evaluate rule');
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Failed to evaluate rule');
  });
});
