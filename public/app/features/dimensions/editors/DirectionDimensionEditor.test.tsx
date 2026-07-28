import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';

import { ConnectionDirection, type DirectionDimensionConfig, DirectionDimensionMode } from '@grafana/schema';

import { DirectionDimensionEditor } from './DirectionDimensionEditor';

function makeProps(value: DirectionDimensionConfig, onChange = jest.fn()) {
  return {
    props: {
      value,
      onChange,
      context: { data: [] },
      item: { settings: {} },
      id: 'direction',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    onChange,
  };
}

describe('DirectionDimensionEditor', () => {
  it('shows the fixed direction selector in Fixed mode', () => {
    const { props } = makeProps({ mode: DirectionDimensionMode.Fixed, fixed: ConnectionDirection.Forward });
    render(<DirectionDimensionEditor {...props} />);

    expect(screen.getByRole('radio', { name: 'Fixed' })).toBeChecked();
    expect(screen.getByText('Forward')).toBeInTheDocument();
  });

  it('switches the source to Field via the radio group', async () => {
    const { props, onChange } = makeProps({ mode: DirectionDimensionMode.Fixed, fixed: ConnectionDirection.Forward });
    const { user } = render(<DirectionDimensionEditor {...props} />);

    await user.click(screen.getByRole('radio', { name: 'Field' }));

    expect(onChange).toHaveBeenCalledWith({
      mode: DirectionDimensionMode.Field,
      fixed: ConnectionDirection.Forward,
    });
  });

  it('sets the fixed direction and clears the field when a direction is chosen', async () => {
    const { props, onChange } = makeProps({ mode: DirectionDimensionMode.Fixed, fixed: ConnectionDirection.Forward });
    render(<DirectionDimensionEditor {...props} />);

    await selectOptionInTest(screen.getByRole('combobox'), 'Reverse');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fixed: ConnectionDirection.Reverse, field: undefined })
    );
  });

  it('renders the field picker instead of the direction selector in Field mode', () => {
    const { props } = makeProps({ mode: DirectionDimensionMode.Field, field: '' });
    render(<DirectionDimensionEditor {...props} />);

    expect(screen.getByRole('radio', { name: 'Field' })).toBeChecked();
    // the fixed-direction option label is gone once we are in Field mode
    expect(screen.queryByText('Forward')).not.toBeInTheDocument();
  });
});
