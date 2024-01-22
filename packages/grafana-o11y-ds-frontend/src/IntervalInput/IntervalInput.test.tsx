import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { invalidTimeShiftError } from '../TraceToLogs/TraceToLogsSettings';

import { IntervalInput } from './IntervalInput';

describe('IntervalInput', () => {
  const IntervalInputtWithProps = ({ val }: { val: string }) => {
    const [value, setValue] = useState(val);

    return (
      <IntervalInput
        label=""
        tooltip=""
        value={value}
        disabled={false}
        onChange={(v) => {
          setValue(v);
        }}
        isInvalidError={invalidTimeShiftError}
      />
    );
  };

  describe('validates time shift correctly', () => {
    it('for previosuly saved invalid value', async () => {
      render(<IntervalInputtWithProps val="77" />);
      expect(screen.getByDisplayValue('77')).toBeInTheDocument();
      expect(screen.getByText(invalidTimeShiftError)).toBeInTheDocument();
    });

    it('for previously saved empty value', async () => {
      render(<IntervalInputtWithProps val="" />);
      expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
      expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
    });

    it('for empty (valid) value', async () => {
      render(<IntervalInputtWithProps val="1ms" />);
      await userEvent.clear(screen.getByDisplayValue('1ms'));
      await waitFor(() => {
        expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
      });
    });

    it('for valid value', async () => {
      render(<IntervalInputtWithProps val="10ms" />);
      expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();

      const input = screen.getByDisplayValue('10ms');
      await userEvent.clear(input);
      await userEvent.type(input, '100s');
      await waitFor(() => {
        expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
      });

      await userEvent.clear(input);
      await userEvent.type(input, '-77ms');
      await waitFor(() => {
        expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
      });
    });

    it('for invalid value', async () => {
      render(<IntervalInputtWithProps val="10ms" />);
      const input = screen.getByDisplayValue('10ms');
      await userEvent.clear(input);
      await userEvent.type(input, 'abc');
      await waitFor(() => {
        expect(screen.queryByText(invalidTimeShiftError)).toBeInTheDocument();
      });
    });
  });
});
