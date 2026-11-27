import { screen, render } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { intervalsToOptions, RefreshPicker, translateOption } from './RefreshPicker';

describe('RefreshPicker', () => {
  describe('intervalsToOptions', () => {
    describe('when called without intervals', () => {
      it('then default options should be used', () => {
        const result = intervalsToOptions();

        expect(result).toEqual([
          { value: '', label: 'Off' },
          { value: '5s', label: '5s', ariaLabel: '5 seconds' },
          { value: '10s', label: '10s', ariaLabel: '10 seconds' },
          { value: '30s', label: '30s', ariaLabel: '30 seconds' },
          { value: '1m', label: '1m', ariaLabel: '1 minute' },
          { value: '5m', label: '5m', ariaLabel: '5 minutes' },
          { value: '15m', label: '15m', ariaLabel: '15 minutes' },
          { value: '30m', label: '30m', ariaLabel: '30 minutes' },
          { value: '1h', label: '1h', ariaLabel: '1 hour' },
          { value: '2h', label: '2h', ariaLabel: '2 hours' },
          { value: '1d', label: '1d', ariaLabel: '1 day' },
        ]);
      });
    });

    describe('when called with intervals', () => {
      it('then the resulting options should be correct', () => {
        const intervals = ['5s', '10s'];

        const result = intervalsToOptions({ intervals });

        expect(result).toEqual([
          { value: '', label: 'Off' },
          { value: '5s', label: '5s', ariaLabel: '5 seconds' },
          { value: '10s', label: '10s', ariaLabel: '10 seconds' },
        ]);
      });
    });

    it('should format durations with multiple units', () => {
      const intervals = ['10s', '1m 30s'];

      const result = intervalsToOptions({ intervals });
      expect(result).toEqual([
        { value: '', label: 'Off' },
        { value: '10s', label: '10s', ariaLabel: '10 seconds' },
        { value: '1m 30s', label: '1m 30s', ariaLabel: '1 minute 30 seconds' },
      ]);
    });
  });
  describe('translateOption', () => {
    it('returns LIVE, Off, auto, and custom options correctly', () => {
      const live = translateOption(RefreshPicker.liveOption.value);
      expect(live).toMatchObject({ value: 'LIVE', label: expect.any(String) });

      const off = translateOption(RefreshPicker.offOption.value);
      expect(off).toMatchObject({ value: '', label: expect.any(String) });

      const auto = translateOption(RefreshPicker.autoOption.value);
      expect(auto).toMatchObject({ value: 'auto', label: expect.any(String) });

      const custom = translateOption('7s');
      expect(custom).toMatchObject({ value: '7s', label: '7s' });
    });
  });
  describe('assign to itself', () => {
    it('isLive, and it returns true only for LIVE', () => {
      expect(RefreshPicker.isLive('LIVE')).toBe(true);
      expect(RefreshPicker.isLive('')).toBe(false);
      expect(RefreshPicker.isLive('5s')).toBe(false);
      expect(RefreshPicker.isLive(undefined)).toBe(false);
    });
    it('offOption, liveOption and autoOption', () => {
      expect(RefreshPicker.offOption).toEqual({ value: '', label: 'Off', ariaLabel: 'Off' });
      expect(RefreshPicker.liveOption).toEqual({ value: 'LIVE', label: 'Live', ariaLabel: 'Live' });
      expect(RefreshPicker.autoOption).toEqual({
        value: 'auto',
        label: 'Auto',
        ariaLabel: 'Auto',
      });
    });
  });
  describe('ButtonSelect', () => {
    it('should show interval picker by default', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} />);
      const button = screen.getByTestId(selectors.components.RefreshPicker.intervalButtonV2);
      expect(button).toBeInTheDocument();
    });
    it('should not show interval picker when noIntervalPicker is true', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} noIntervalPicker />);
      const button = screen.queryByTestId(selectors.components.RefreshPicker.intervalButtonV2);
      expect(button).not.toBeInTheDocument();
    });
  });
  describe('run button', () => {
    it('should show its text when it has text', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} text="Run" />);
      expect(screen.getByRole('button', { name: 'Run' })).toHaveTextContent('Run');
    });
    it('should be an icon-only button named Refresh when it has no text', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} />);
      const button = screen.getByRole('button', { name: 'Refresh' });
      expect(button).toBe(screen.getByTestId(selectors.components.RefreshPicker.runButtonV2));
      expect(button.querySelector('div')).not.toBeInTheDocument();
    });
    it('should keep Refresh as hidden text when it has no text', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} />);
      expect(screen.getByTestId(selectors.components.RefreshPicker.runButtonV2)).toHaveTextContent('Refresh');
    });
    it('should use the tooltip as its name when it has no text', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} isLoading tooltip="Cancel all queries" />);
      expect(screen.getByRole('button', { name: 'Cancel all queries' })).toBeInTheDocument();
    });
    it('should use the tooltip as its name while loading when it has text but no loading text', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} text="5s" isLoading tooltip="Cancel all queries" />);
      expect(screen.getByRole('button', { name: 'Cancel all queries' })).toBeInTheDocument();
    });
    it('should use the loading text as its name while loading', () => {
      render(<RefreshPicker onIntervalChanged={jest.fn()} text="Refresh" loadingText="Cancel" isLoading />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });
});
