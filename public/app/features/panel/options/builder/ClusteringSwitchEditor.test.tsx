import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClusteringSwitchEditor } from './ClusteringSwitchEditor';

describe('ClusteringSwitchEditor', () => {
  it('should render a switch', () => {
    render(<ClusteringSwitchEditor value={0} onChange={() => {}} item={{} as never} context={{} as never} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
  it('should display switch as unchecked when value is 0', () => {
    render(<ClusteringSwitchEditor value={0} onChange={() => {}} item={{} as never} context={{} as never} />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });
  it('should display switch as checked when value is greater than 0', () => {
    render(<ClusteringSwitchEditor value={24} onChange={() => {}} item={{} as never} context={{} as never} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });
  it('should call onChange when toggling from off to on', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ClusteringSwitchEditor value={0} onChange={onChange} item={{} as never} context={{} as never} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(24);
  });
  it('should call onChange when toggling from on to off', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<ClusteringSwitchEditor value={24} onChange={onChange} item={{} as never} context={{} as never} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
