import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { TimeRangeShift } from './TimeRangeShift';
import { invalidTimeShiftError, validateTimeShift } from './validation';

describe('TimeRangeShift', () => {
  const TimeRangeShiftWithProps = ({ val }: { val: string }) => {
    const [spanTimeShiftIsInvalid, setSpanTimeShiftIsInvalid] = useState(() => {
      return val ? validateTimeShift(val) : false;
    });
    const [value, setValue] = useState(val);

    return (
      <TimeRangeShift
        label=""
        tooltip=""
        value={value}
        disabled={false}
        onChange={(v) => {
          setSpanTimeShiftIsInvalid(validateTimeShift(v));
          setValue(v);
        }}
        isInvalid={spanTimeShiftIsInvalid}
        invalidTimeShiftError={invalidTimeShiftError}
      />
    );
  };

  describe('validates time shift correctly', () => {
    it('for previosuly saved invalid value', async () => {
      render(<TimeRangeShiftWithProps val="77" />);
      expect(screen.getByDisplayValue('77')).toBeInTheDocument();
      expect(screen.getByText(invalidTimeShiftError)).toBeInTheDocument();
    });

    it('for previously saved empty value', async () => {
      render(<TimeRangeShiftWithProps val="" />);
      expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
      expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
    });

    it('for empty (valid) value', async () => {
      render(<TimeRangeShiftWithProps val="1ms" />);
      await userEvent.clear(screen.getByDisplayValue('1ms'));
      await waitFor(() => {
        expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
      });
    });

    it('for valid value', async () => {
      render(<TimeRangeShiftWithProps val="10ms" />);
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
      render(<TimeRangeShiftWithProps val="10ms" />);
      const input = screen.getByDisplayValue('10ms');
      await userEvent.clear(input);
      await userEvent.type(input, 'abc');
      await waitFor(() => {
        expect(screen.queryByText(invalidTimeShiftError)).toBeInTheDocument();
      });
    });
  });
});
