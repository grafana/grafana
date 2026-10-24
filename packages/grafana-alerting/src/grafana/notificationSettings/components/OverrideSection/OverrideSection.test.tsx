import { render, screen } from '../../../../../tests/test-utils';

import { OverrideSection } from './OverrideSection';

function renderSection(props: Partial<React.ComponentProps<typeof OverrideSection>> = {}) {
  return render(
    <OverrideSection label="Override thing" summary="Default thing" overridden={false} onToggle={jest.fn()} {...props}>
      <div>override fields</div>
    </OverrideSection>
  );
}

describe('OverrideSection', () => {
  it('shows the summary and hides the children while not overridden', () => {
    renderSection();

    expect(screen.getByRole('switch', { name: 'Override thing' })).not.toBeChecked();
    expect(screen.getByText('Default thing')).toBeInTheDocument();
    expect(screen.queryByText('override fields')).not.toBeInTheDocument();
  });

  it('shows the children and hides the summary while overridden', () => {
    renderSection({ overridden: true });

    expect(screen.getByRole('switch', { name: 'Override thing' })).toBeChecked();
    expect(screen.queryByText('Default thing')).not.toBeInTheDocument();
    expect(screen.getByText('override fields')).toBeInTheDocument();
  });

  it('calls onToggle and reveals the children on click, even when the parent has no value for it yet', async () => {
    const onToggle = jest.fn();
    const { user } = renderSection({ onToggle });

    await user.click(screen.getByRole('switch', { name: 'Override thing' }));

    expect(onToggle).toHaveBeenCalledWith(true);
    expect(screen.getByText('override fields')).toBeInTheDocument();
  });

  it('calls onToggle(false) when switched back off', async () => {
    const onToggle = jest.fn();
    const { user } = renderSection({ overridden: true, onToggle });

    await user.click(screen.getByRole('switch', { name: 'Override thing' }));

    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.queryByText('override fields')).not.toBeInTheDocument();
  });

  it('follows `overridden` when it changes after mount', () => {
    const { renderResult } = renderSection();

    renderResult.rerender(
      <OverrideSection label="Override thing" summary="Default thing" overridden onToggle={jest.fn()}>
        <div>override fields</div>
      </OverrideSection>
    );

    expect(screen.getByRole('switch', { name: 'Override thing' })).toBeChecked();
    expect(screen.getByText('override fields')).toBeInTheDocument();
  });

  it('stays on when `overridden` turns false, since only the user switches an override off', () => {
    const { renderResult } = renderSection({ overridden: true });

    renderResult.rerender(
      <OverrideSection label="Override thing" summary="Default thing" overridden={false} onToggle={jest.fn()}>
        <div>override fields</div>
      </OverrideSection>
    );

    expect(screen.getByRole('switch', { name: 'Override thing' })).toBeChecked();
    expect(screen.getByText('override fields')).toBeInTheDocument();
  });

  it('disables the switch', () => {
    renderSection({ disabled: true });

    expect(screen.getByRole('switch', { name: 'Override thing' })).toBeDisabled();
  });
});
