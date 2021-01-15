import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultIntervals } from '@grafana/ui';

import { AutoRefreshIntervals, getValidIntervals, Props, validateIntervals } from './AutoRefreshIntervals';
import { TimeSrv } from '../../services/TimeSrv';

const setupTestContext = (options: Partial<Props>) => {
  const defaults: Props = {
    renderCount: 0,
    refreshIntervals: ['1s', '5s', '10s'],
    onRefreshIntervalChange: jest.fn(),
    getIntervalsFunc: intervals => intervals,
    validateIntervalsFunc: () => null,
  };

  const props = { ...defaults, ...options };
  const { rerender } = render(<AutoRefreshIntervals {...props} />);

  return { rerender, props };
};

describe('AutoRefreshIntervals', () => {
  describe('when component is mounted with refreshIntervals', () => {
    it('then supplied intervals should be shown', () => {
      setupTestContext({ getIntervalsFunc: () => ['5s', '10s'] }); // remove 1s entry to validate we're calling getIntervalsFunc

      expect(screen.getByRole('textbox')).toHaveValue('5s,10s');
    });
  });

  describe('when component is mounted without refreshIntervals', () => {
    it('then default intervals should be shown', () => {
      setupTestContext({ refreshIntervals: (null as unknown) as string[] });

      expect(screen.getByRole('textbox')).toHaveValue('5s,10s,30s,1m,5m,15m,30m,1h,2h,1d');
    });
  });

  describe('when component is updated from Angular', () => {
    it('then intervals should be updated', () => {
      const { rerender, props } = setupTestContext({});
      const newProps = { ...props, renderCount: 1, refreshIntervals: ['2s', '6s', '11s'] };

      rerender(<AutoRefreshIntervals {...newProps} />);

      expect(screen.getByRole('textbox')).toHaveValue('2s,6s,11s');
    });
  });

  describe('when input loses focus and intervals are valid', () => {
    it('then onRefreshIntervalChange should be called', () => {
      const { props } = setupTestContext({ validateIntervalsFunc: () => null });

      userEvent.type(screen.getByRole('textbox'), ',30s');
      userEvent.tab();

      expect(screen.getByRole('textbox')).toHaveValue('1s,5s,10s,30s');
      expect(props.onRefreshIntervalChange).toHaveBeenCalledTimes(1);
      expect(props.onRefreshIntervalChange).toHaveBeenCalledWith(['1s', '5s', '10s', '30s']);
    });
  });

  describe('when input loses focus and intervals are invalid', () => {
    it('then onRefreshIntervalChange should not be called', () => {
      const { props } = setupTestContext({ validateIntervalsFunc: () => 'Not valid' });

      userEvent.type(screen.getByRole('textbox'), ',30q');
      userEvent.tab();

      expect(screen.getByRole('textbox')).toHaveValue('1s,5s,10s,30q');
      expect(props.onRefreshIntervalChange).toHaveBeenCalledTimes(0);
    });
  });

  describe('when input loses focus and previous intervals were invalid', () => {
    it('then onRefreshIntervalChange should be called', () => {
      const validateIntervalsFunc = jest
        .fn()
        .mockReturnValueOnce('Not valid')
        .mockReturnValue(null);
      const { props } = setupTestContext({ validateIntervalsFunc });

      userEvent.type(screen.getByRole('textbox'), ',30q');
      userEvent.tab();
      userEvent.type(screen.getByRole('textbox'), '{backspace}s');
      userEvent.tab();

      expect(screen.getByRole('textbox')).toHaveValue('1s,5s,10s,30s');
      expect(props.onRefreshIntervalChange).toHaveBeenCalledTimes(1);
      expect(props.onRefreshIntervalChange).toHaveBeenCalledWith(['1s', '5s', '10s', '30s']);
    });
  });
});

describe('getValidIntervals', () => {
  describe('when called with empty intervals', () => {
    it('then is should all non empty intervals', () => {
      const emptyIntervals = ['', '5s', ' ', '10s', '  '];
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = getValidIntervals(emptyIntervals, dependencies);

      expect(result).toEqual(['5s', '10s']);
    });
  });

  describe('when called with duplicate intervals', () => {
    it('then is should return no duplicates', () => {
      const duplicateIntervals = ['5s', '10s', '1m', '5s', '30s', '10s', '5s', '2m'];
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = getValidIntervals(duplicateIntervals, dependencies);

      expect(result).toEqual(['5s', '10s', '1m', '30s', '2m']);
    });
  });

  describe('when called with untrimmed intervals', () => {
    it('then is should return trimmed intervals', () => {
      const duplicateIntervals = [' 5s', '10s ', ' 1m ', ' 3 0 s ', '   2      m     '];
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = getValidIntervals(duplicateIntervals, dependencies);

      expect(result).toEqual(['5s', '10s', '1m', '30s', '2m']);
    });
  });
});

describe('validateIntervals', () => {
  describe('when getValidIntervals does not throw', () => {
    it('then it should return null', () => {
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = validateIntervals(defaultIntervals, dependencies);

      expect(result).toBe(null);
    });
  });

  describe('when getValidIntervals throws', () => {
    it('then it should return the exception message', () => {
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: () => {
              throw new Error('Some error');
            },
          } as unknown) as TimeSrv),
      };

      const result = validateIntervals(defaultIntervals, dependencies);

      expect(result).toEqual('Some error');
    });
  });
});
