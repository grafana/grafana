import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InputPrefix, NullsThresholdInput } from './NullsThresholdInput';

describe('NullsThresholdInput', () => {
  describe('Display value', () => {
    it('should format value as duration when isTime is true', () => {
      const onChange = jest.fn();
      render(<NullsThresholdInput value={3600000} onChange={onChange} isTime={true} />);

      expect(screen.getByRole('textbox')).toHaveValue('1h');
    });

    it('should show hardcoded default when isTime is false', () => {
      const onChange = jest.fn();
      render(<NullsThresholdInput value={5000} onChange={onChange} isTime={false} />);

      expect(screen.getByRole('textbox')).toHaveValue('10');
    });
  });

  describe('Prefix', () => {
    it('should show ">" prefix for GreaterThan', () => {
      const onChange = jest.fn();
      render(
        <NullsThresholdInput value={3600000} onChange={onChange} isTime={true} inputPrefix={InputPrefix.GreaterThan} />
      );

      expect(screen.getByText('>')).toBeInTheDocument();
    });

    it('should show "<" prefix for LessThan', () => {
      const onChange = jest.fn();
      render(
        <NullsThresholdInput value={3600000} onChange={onChange} isTime={true} inputPrefix={InputPrefix.LessThan} />
      );

      expect(screen.getByText('<')).toBeInTheDocument();
    });
  });

  describe('Value submission', () => {
    it('should call onChange with milliseconds on blur for valid time input', async () => {
      const onChange = jest.fn();
      render(<NullsThresholdInput value={3600000} onChange={onChange} isTime={true} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, '2h');
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledWith(7200000);
    });

    it('should call onChange with numeric value on blur when isTime is false', async () => {
      const onChange = jest.fn();
      render(<NullsThresholdInput value={5000} onChange={onChange} isTime={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, '42');
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledWith(42);
    });

    it('should call onChange with false on blur with empty input', async () => {
      const onChange = jest.fn();
      render(<NullsThresholdInput value={3600000} onChange={onChange} isTime={true} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should call onChange on Enter key', async () => {
      const onChange = jest.fn();
      render(<NullsThresholdInput value={3600000} onChange={onChange} isTime={true} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, '30m{Enter}');

      expect(onChange).toHaveBeenCalledWith(1800000);
    });
  });
});
