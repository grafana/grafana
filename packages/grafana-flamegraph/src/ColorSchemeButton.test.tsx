import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ColorSchemeButton } from './ColorSchemeButton';
import { ColorScheme, DataSourceType } from './types';

describe('ColorSchemeButton', () => {
  const setup = (dataSource?: DataSourceType, onChange = jest.fn()) => {
    render(
      <ColorSchemeButton
        value={ColorScheme.PackageBased}
        onChange={onChange}
        isDiffMode={false}
        dataSource={dataSource}
      />
    );
    return { onChange };
  };

  it('shows the kernel/user space option for Pyroscope', async () => {
    setup(DataSourceType.PprofPyroscope);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('By kernel/user space')).toBeInTheDocument();
  });

  it.each([DataSourceType.Unknown, undefined])('hides the option for %p', async (dataSource) => {
    setup(dataSource);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('By value')).toBeInTheDocument();
    expect(screen.queryByText('By kernel/user space')).not.toBeInTheDocument();
  });

  it('calls onChange with SpaceBased when the option is selected', async () => {
    const { onChange } = setup(DataSourceType.PprofPyroscope);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('By kernel/user space'));
    expect(onChange).toHaveBeenCalledWith(ColorScheme.SpaceBased);
  });
});
