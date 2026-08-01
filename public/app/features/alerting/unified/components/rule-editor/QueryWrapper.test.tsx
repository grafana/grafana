import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';

describe('QueryWrapper options', () => {
  describe('MaxDataPointsOption', () => {
    it('should call onChange with updated value on unmount', () => {
      const onChange = jest.fn();
      const options = { maxDataPoints: 100 };

      const { unmount } = render(<MaxDataPointsOption options={options} onChange={onChange} />);

      const input = screen.getByRole('spinbutton');
      
      // Simulate user typing a new value without blurring
      fireEvent.change(input, { target: { value: '200' } });

      // onChange should not be called yet
      expect(onChange).not.toHaveBeenCalled();

      // Unmount the component (simulating tooltip close)
      unmount();

      // Now onChange should be called with the new value
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ maxDataPoints: 200 });
    });

    it('should not call onChange if value is not changed', () => {
      const onChange = jest.fn();
      const options = { maxDataPoints: 100 };

      const { unmount } = render(<MaxDataPointsOption options={options} onChange={onChange} />);

      unmount();

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should handle Enter key to save', async () => {
      const onChange = jest.fn();
      const options = { maxDataPoints: 100 };

      render(<MaxDataPointsOption options={options} onChange={onChange} />);

      const input = screen.getByRole('spinbutton');
      
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ maxDataPoints: 200 });
    });
  });

  describe('MinIntervalOption', () => {
    it('should call onChange with updated value on unmount', () => {
      const onChange = jest.fn();
      const options = { minInterval: '1m' };

      const { unmount } = render(<MinIntervalOption options={options} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: '5m' } });
      expect(onChange).not.toHaveBeenCalled();

      unmount();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ minInterval: '5m' });
    });

    it('should ignore invalid interval values and not call onChange', () => {
      const onChange = jest.fn();
      const options = { minInterval: '1m' };

      const { unmount } = render(<MinIntervalOption options={options} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      
      // Simulate user typing an invalid interval
      fireEvent.change(input, { target: { value: 'abc' } });
      
      unmount();

      // onChange should not be called with an invalid value
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
