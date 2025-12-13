import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';



import { AlertQueryOptions, MaxDataPointsOption, MinIntervalOption, DEFAULT_MAX_DATA_POINTS, DEFAULT_MIN_INTERVAL } from './QueryWrapper';

const defaultOptions: AlertQueryOptions = {
  maxDataPoints: 100,
  minInterval: '1m',
};

describe('MaxDataPointsOption Component', () => {
  const defaultProps = {
    options: defaultOptions,
    onChange: jest.fn(),
    inputRef: React.createRef<HTMLInputElement>(),
  };

  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.log to prevent test failures due to debug logging
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  describe('Rendering', () => {
    it('should render with current value', () => {
      render(<MaxDataPointsOption {...defaultProps} />);
      
      const input = screen.getByDisplayValue('100');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should render with placeholder when no value is set', () => {
      const props = {
        ...defaultProps,
        options: { ...defaultOptions, maxDataPoints: undefined },
      };
      
      render(<MaxDataPointsOption {...props} />);
      
      const input = screen.getByPlaceholderText(DEFAULT_MAX_DATA_POINTS.toString());
      expect(input).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('');
    });

    it('should assign inputRef to the input element', () => {
      const ref = React.createRef<HTMLInputElement>();
      const props = { ...defaultProps, inputRef: ref };
      
      render(<MaxDataPointsOption {...props} />);
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.value).toBe('100');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when value is blurred', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MaxDataPointsOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.type(input, '200');
      await user.tab(); // This triggers blur

      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        maxDataPoints: 200,
      });
    });

    it('should handle empty input value on blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MaxDataPointsOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.tab(); // Trigger blur

      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        maxDataPoints: undefined,
      });
    });

    it('should handle zero value on blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MaxDataPointsOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.type(input, '0');
      await user.tab(); // Trigger blur

      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        maxDataPoints: undefined,
      });
    });

    it('should handle invalid input value on blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MaxDataPointsOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.type(input, 'invalid');
      await user.tab(); // Trigger blur

      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        maxDataPoints: undefined,
      });
    });

    it('should not call onChange if value has not changed', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MaxDataPointsOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('100');
      await user.click(input);
      await user.tab(); // Trigger blur without changing value

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should update local state on type but not call onChange until blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MaxDataPointsOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.type(input, '200');
      
      // Should show new value but not have called onChange yet
      expect(input).toHaveValue(200);
      expect(onChange).not.toHaveBeenCalled();
      
      // Now blur should trigger onChange
      await user.tab();
      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        maxDataPoints: 200,
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper label', () => {
      render(<MaxDataPointsOption {...defaultProps} />);
      
      expect(screen.getByText('Max data points')).toBeInTheDocument();
    });

    it('should have proper input attributes', () => {
      render(<MaxDataPointsOption {...defaultProps} />);
      
      const input = screen.getByDisplayValue('100');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('placeholder', DEFAULT_MAX_DATA_POINTS.toString());
    });
  });
});

describe('MinIntervalOption Component', () => {
  const defaultProps = {
    options: defaultOptions,
    onChange: jest.fn(),
    inputRef: React.createRef<HTMLInputElement>(),
  };

  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.log to prevent test failures due to debug logging
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  describe('Rendering', () => {
    it('should render with current value', () => {
      render(<MinIntervalOption {...defaultProps} />);
      
      const input = screen.getByDisplayValue('1m');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render with placeholder when no value is set', () => {
      const props = {
        ...defaultProps,
        options: { ...defaultOptions, minInterval: undefined },
      };
      
      render(<MinIntervalOption {...props} />);
      
      const input = screen.getByPlaceholderText(DEFAULT_MIN_INTERVAL);
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('');
    });

    it('should assign inputRef to the input element', () => {
      const ref = React.createRef<HTMLInputElement>();
      const props = { ...defaultProps, inputRef: ref };
      
      render(<MinIntervalOption {...props} />);
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.value).toBe('1m');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when value is blurred', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MinIntervalOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('1m');
      await user.clear(input);
      await user.type(input, '30s');
      await user.tab(); // Trigger blur

      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        minInterval: '30s',
      });
    });

    it('should handle empty input value on blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MinIntervalOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('1m');
      await user.clear(input);
      await user.tab(); // Trigger blur

      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        minInterval: '',
      });
    });

    it('should handle various time formats on blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MinIntervalOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('1m');
      const timeFormats = ['5s', '10m', '1h', '2d'];
      
      for (const format of timeFormats) {
        await user.clear(input);
        await user.type(input, format);
        await user.tab(); // Trigger blur
        
        expect(onChange).toHaveBeenCalledWith({
          ...defaultOptions,
          minInterval: format,
        });
        
        onChange.mockClear();
      }
    });

    it('should handle whitespace in input on blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MinIntervalOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('1m');
      await user.clear(input);
      await user.type(input, '  15s  ');
      await user.tab(); // Trigger blur

      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        minInterval: '  15s  ',
      });
    });

    it('should not call onChange if value has not changed', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MinIntervalOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('1m');
      await user.click(input);
      await user.tab(); // Trigger blur without changing value

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should update local state on type but not call onChange until blur', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<MinIntervalOption {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByDisplayValue('1m');
      await user.clear(input);
      await user.type(input, '45s');
      
      // Should show new value but not have called onChange yet
      expect(input).toHaveValue('45s');
      expect(onChange).not.toHaveBeenCalled();
      
      // Now blur should trigger onChange
      await user.tab();
      expect(onChange).toHaveBeenCalledWith({
        ...defaultOptions,
        minInterval: '45s',
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper label', () => {
      render(<MinIntervalOption {...defaultProps} />);
      
      expect(screen.getByText('Interval')).toBeInTheDocument();
    });

    it('should have proper input attributes', () => {
      render(<MinIntervalOption {...defaultProps} />);
      
      const input = screen.getByDisplayValue('1m');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('placeholder', DEFAULT_MIN_INTERVAL);
    });
  });
});

describe('AlertQueryOptions Interface', () => {
  it('should have correct type definitions', () => {
    const options: AlertQueryOptions = {
      maxDataPoints: 100,
      minInterval: '1m',
    };

    expect(typeof options.maxDataPoints).toBe('number');
    expect(typeof options.minInterval).toBe('string');
  });

  it('should allow undefined values', () => {
    const options: AlertQueryOptions = {
      maxDataPoints: undefined,
      minInterval: undefined,
    };

    expect(options.maxDataPoints).toBeUndefined();
    expect(options.minInterval).toBeUndefined();
  });
});

describe('Default Constants', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_MAX_DATA_POINTS).toBe(43200);
    expect(DEFAULT_MIN_INTERVAL).toBe('1s');
  });
});