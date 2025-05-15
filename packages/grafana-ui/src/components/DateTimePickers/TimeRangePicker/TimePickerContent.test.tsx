import { render, RenderResult, screen } from '@testing-library/react';

import { dateTime, TimeRange } from '@grafana/data';

import { PropsWithScreenSize, TimePickerContentWithScreenSize } from './TimePickerContent';

describe('TimePickerContent', () => {
  const absoluteValue = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:49:27.433Z');
  const relativeValue = createRelativeTimeRange();
  const history = [
    createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-17T07:49:27.433Z'),
    createAbsoluteTimeRange('2019-10-18T07:50:27.433Z', '2019-10-18T07:51:27.433Z'),
  ];

  describe('Wide Screen', () => {
    it('renders with history', () => {
      renderComponent({ value: absoluteValue, history });
      expect(screen.getByText(/recently used absolute ranges/i)).toBeInTheDocument();
      expect(screen.getByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).toBeInTheDocument();
      expect(screen.getByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).toBeInTheDocument();
    });

    it('renders with empty history', () => {
      renderComponent({ value: absoluteValue });
      expect(screen.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(
        screen.getByText(
          /it looks like you haven't used this time picker before\. as soon as you enter some time intervals, recently used intervals will appear here\./i
        )
      ).toBeInTheDocument();
    });

    it('renders without history', () => {
      renderComponent({ value: absoluteValue, history, showHistory: false });
      expect(screen.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).not.toBeInTheDocument();
    });

    it('renders with relative picker', () => {
      renderComponent({ value: absoluteValue });
      expect(screen.getByText(/Last 5 minutes/i)).toBeInTheDocument();
    });

    it('renders without relative picker', () => {
      renderComponent({ value: absoluteValue, hideQuickRanges: true });
      expect(screen.queryByText(/Last 5 minutes/i)).not.toBeInTheDocument();
    });

    it('renders with timezone picker', () => {
      renderComponent({ value: absoluteValue, hideTimeZone: false });
      expect(screen.getByText(/coordinated universal time/i)).toBeInTheDocument();
    });

    it('renders without timezone picker', () => {
      renderComponent({ value: absoluteValue, hideTimeZone: true });
      expect(screen.queryByText(/coordinated universal time/i)).not.toBeInTheDocument();
    });
  });

  describe('Narrow Screen', () => {
    it('renders with history', () => {
      renderComponent({ value: absoluteValue, history, isFullscreen: false });
      expect(screen.getByText(/recently used absolute ranges/i)).toBeInTheDocument();
      expect(screen.getByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).toBeInTheDocument();
      expect(screen.getByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).toBeInTheDocument();
    });

    it('renders with empty history', () => {
      renderComponent({ value: absoluteValue, isFullscreen: false });
      expect(screen.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          /it looks like you haven't used this time picker before\. as soon as you enter some time intervals, recently used intervals will appear here\./i
        )
      ).not.toBeInTheDocument();
    });

    it('renders without history', () => {
      renderComponent({ value: absoluteValue, isFullscreen: false, history, showHistory: false });
      expect(screen.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).not.toBeInTheDocument();
    });

    it('renders with relative picker', () => {
      renderComponent({ value: absoluteValue, isFullscreen: false });
      expect(screen.getByText(/Last 5 minutes/i)).toBeInTheDocument();
    });

    it('renders without relative picker', () => {
      renderComponent({ value: absoluteValue, isFullscreen: false, hideQuickRanges: true });
      expect(screen.queryByText(/Last 5 minutes/i)).not.toBeInTheDocument();
    });

    it('renders with absolute picker when absolute value and quick ranges are visible', () => {
      renderComponent({ value: absoluteValue, isFullscreen: false });
      expect(screen.getByLabelText('From')).toBeInTheDocument();
    });

    it('renders with absolute picker when absolute value and quick ranges are hidden', () => {
      renderComponent({ value: absoluteValue, isFullscreen: false, hideQuickRanges: true });
      expect(screen.getByLabelText('From')).toBeInTheDocument();
    });

    it('renders without absolute picker when narrow screen and quick ranges are visible', () => {
      renderComponent({ value: relativeValue, isFullscreen: false });
      expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    });

    it('renders with absolute picker when narrow screen and quick ranges are hidden', () => {
      renderComponent({ value: relativeValue, isFullscreen: false, hideQuickRanges: true });
      expect(screen.getByLabelText('From')).toBeInTheDocument();
    });

    it('renders without timezone picker', () => {
      renderComponent({ value: absoluteValue, hideTimeZone: true });
      expect(screen.queryByText(/coordinated universal time/i)).not.toBeInTheDocument();
    });
  });
});

function noop(): {} {
  return {};
}

function renderComponent({
  value,
  isFullscreen = true,
  showHistory = true,
  history = [],
  hideQuickRanges = false,
  hideTimeZone = false,
}: Pick<PropsWithScreenSize, 'value'> & Partial<PropsWithScreenSize>): RenderResult {
  return render(
    <TimePickerContentWithScreenSize
      onChangeTimeZone={noop}
      onChange={noop}
      quickOptions={[
        { from: 'now-5m', to: 'now', display: 'Last 5 minutes' },
        { from: 'now-15m', to: 'now', display: 'Last 15 minutes' },
      ]}
      timeZone="utc"
      value={value}
      isFullscreen={isFullscreen}
      showHistory={showHistory}
      history={history}
      hideQuickRanges={hideQuickRanges}
      hideTimeZone={hideTimeZone}
    />
  );
}

function createRelativeTimeRange(): TimeRange {
  const now = dateTime();
  const now5m = now.subtract(5, 'm');

  return {
    from: now5m,
    to: now,
    raw: { from: 'now-5m', to: 'now' },
  };
}

function createAbsoluteTimeRange(from: string, to: string): TimeRange {
  return {
    from: dateTime(from),
    to: dateTime(to),
    raw: { from: dateTime(from), to: dateTime(to) },
  };
}
