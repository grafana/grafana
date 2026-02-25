import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SegmentedToggle, SegmentedToggleOption } from './SegmentedToggle';

type View = 'data' | 'alerts' | 'transforms';

const OPTIONS: Array<SegmentedToggleOption<View>> = [
  { value: 'data', label: 'Data' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'transforms', label: 'Transforms' },
];

function renderToggle(value: View = 'data', onChange = jest.fn()) {
  // OPTIONS satisfies the minimum-2 tuple requirement at runtime;
  // cast keeps TypeScript happy without verbose inline tuple types.
  return render(
    <SegmentedToggle
      options={
        OPTIONS as [SegmentedToggleOption<View>, SegmentedToggleOption<View>, ...Array<SegmentedToggleOption<View>>]
      }
      value={value}
      onChange={onChange}
      aria-label="View"
    />
  );
}

describe('SegmentedToggle', () => {
  describe('ARIA semantics', () => {
    it('renders a radiogroup with the provided aria-label', () => {
      renderToggle();
      expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument();
    });

    it('renders each option as a radio button', () => {
      renderToggle();
      expect(screen.getAllByRole('radio')).toHaveLength(OPTIONS.length);
    });

    it('marks only the active option as checked', () => {
      renderToggle('alerts');

      expect(screen.getByRole('radio', { name: 'Data' })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('radio', { name: 'Alerts' })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: 'Transforms' })).toHaveAttribute('aria-checked', 'false');
    });

    // Radiogroup keyboard pattern: only the active option is in the tab order.
    // Users Tab into the group, then use arrow keys to navigate within it.
    it('puts only the active option in the tab order', () => {
      renderToggle('alerts');

      expect(screen.getByRole('radio', { name: 'Data' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('radio', { name: 'Alerts' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('radio', { name: 'Transforms' })).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('mouse interaction', () => {
    it('calls onChange with the value of the clicked option', async () => {
      const onChange = jest.fn();
      renderToggle('data', onChange);

      await userEvent.click(screen.getByRole('radio', { name: 'Alerts' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('alerts');
    });
  });

  describe('keyboard navigation', () => {
    it.each(['{ArrowRight}', '{ArrowDown}'])('%s advances to the next option', async (key) => {
      const onChange = jest.fn();
      renderToggle('data', onChange);

      screen.getByRole('radio', { name: 'Data' }).focus();
      await userEvent.keyboard(key);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('alerts');
    });

    it.each(['{ArrowLeft}', '{ArrowUp}'])('%s retreats to the previous option', async (key) => {
      const onChange = jest.fn();
      renderToggle('alerts', onChange);

      screen.getByRole('radio', { name: 'Alerts' }).focus();
      await userEvent.keyboard(key);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('data');
    });

    it('wraps forward from the last option to the first', async () => {
      const onChange = jest.fn();
      renderToggle('transforms', onChange);

      screen.getByRole('radio', { name: 'Transforms' }).focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('data');
    });

    it('wraps backward from the first option to the last', async () => {
      const onChange = jest.fn();
      renderToggle('data', onChange);

      screen.getByRole('radio', { name: 'Data' }).focus();
      await userEvent.keyboard('{ArrowLeft}');

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('transforms');
    });

    it('moves focus to the navigated option', async () => {
      renderToggle('data');

      screen.getByRole('radio', { name: 'Data' }).focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Alerts' }));
    });
  });
});
