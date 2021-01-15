import { dateTime, TimeRange } from '@grafana/data';
import { render, RenderResult } from '@testing-library/react';
import React from 'react';
import { TimePickerContentWithScreenSize } from './TimePickerContent';

describe('TimePickerContent', () => {
  const absoluteValue = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:49:27.433Z');
  const relativeValue = createRelativeTimeRange();
  const history = [
    createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-17T07:49:27.433Z'),
    createAbsoluteTimeRange('2019-10-18T07:50:27.433Z', '2019-10-18T07:51:27.433Z'),
  ];

  describe('Wide Screen', () => {
    it('renders with history', () => {
      const container = renderComponent({ value: absoluteValue, history });
      expect(container.queryByText(/recently used absolute ranges/i)).toBeInTheDocument();
      expect(container.queryByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).toBeInTheDocument();
      expect(container.queryByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).toBeInTheDocument();
    });

    it('renders with empty history', () => {
      const container = renderComponent({ value: absoluteValue });
      expect(container.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(
        container.queryByText(
          /it looks like you haven't used this time picker before\. as soon as you enter some time intervals, recently used intervals will appear here\./i
        )
      ).toBeInTheDocument();
    });

    it('renders without history', () => {
      const container = renderComponent({ value: absoluteValue, history, showHistory: false });
      expect(container.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(container.queryByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).not.toBeInTheDocument();
      expect(container.queryByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).not.toBeInTheDocument();
    });

    it('renders with relative picker', () => {
      const container = renderComponent({ value: absoluteValue });
      expect(container.queryByText(/relative time ranges/i)).toBeInTheDocument();
      expect(container.queryByText(/other quick ranges/i)).toBeInTheDocument();
    });

    it('renders without relative picker', () => {
      const container = renderComponent({ value: absoluteValue, hideQuickRanges: true });
      expect(container.queryByText(/relative time ranges/i)).not.toBeInTheDocument();
      expect(container.queryByText(/other quick ranges/i)).not.toBeInTheDocument();
    });

    it('renders with timezone picker', () => {
      const container = renderComponent({ value: absoluteValue, hideTimeZone: false });
      expect(container.queryByText(/coordinated universal time/i)).toBeInTheDocument();
    });

    it('renders without timezone picker', () => {
      const container = renderComponent({ value: absoluteValue, hideTimeZone: true });
      expect(container.queryByText(/coordinated universal time/i)).not.toBeInTheDocument();
    });
  });

  describe('Narrow Screen', () => {
    it('renders with history', () => {
      const container = renderComponent({ value: absoluteValue, history, isFullscreen: false });
      expect(container.queryByText(/recently used absolute ranges/i)).toBeInTheDocument();
      expect(container.queryByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).toBeInTheDocument();
      expect(container.queryByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).toBeInTheDocument();
    });

    it('renders with empty history', () => {
      const container = renderComponent({ value: absoluteValue, isFullscreen: false });
      expect(container.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(
        container.queryByText(
          /it looks like you haven't used this time picker before\. as soon as you enter some time intervals, recently used intervals will appear here\./i
        )
      ).not.toBeInTheDocument();
    });

    it('renders without history', () => {
      const container = renderComponent({ value: absoluteValue, isFullscreen: false, history, showHistory: false });
      expect(container.queryByText(/recently used absolute ranges/i)).not.toBeInTheDocument();
      expect(container.queryByText(/2019-12-17 07:48:27 to 2019-12-17 07:49:27/i)).not.toBeInTheDocument();
      expect(container.queryByText(/2019-10-18 07:50:27 to 2019-10-18 07:51:27/i)).not.toBeInTheDocument();
    });

    it('renders with relative picker', () => {
      const container = renderComponent({ value: absoluteValue, isFullscreen: false });
      expect(container.queryByText(/relative time ranges/i)).toBeInTheDocument();
      expect(container.queryByText(/other quick ranges/i)).toBeInTheDocument();
    });

    it('renders without relative picker', () => {
      const container = renderComponent({ value: absoluteValue, isFullscreen: false, hideQuickRanges: true });
      expect(container.queryByText(/relative time ranges/i)).not.toBeInTheDocument();
      expect(container.queryByText(/other quick ranges/i)).not.toBeInTheDocument();
    });

    it('renders with absolute picker when absolute value and quick ranges are visible', () => {
      const container = renderComponent({ value: absoluteValue, isFullscreen: false });
      expect(container.queryByLabelText(/timepicker from field/i)).toBeInTheDocument();
    });

    it('renders with absolute picker when absolute value and quick ranges are hidden', () => {
      const container = renderComponent({ value: absoluteValue, isFullscreen: false, hideQuickRanges: true });
      expect(container.queryByLabelText(/timepicker from field/i)).toBeInTheDocument();
    });

    it('renders without absolute picker when narrow screen and quick ranges are visible', () => {
      const container = renderComponent({ value: relativeValue, isFullscreen: false });
      expect(container.queryByLabelText(/timepicker from field/i)).not.toBeInTheDocument();
    });

    it('renders with absolute picker when narrow screen and quick ranges are hidden', () => {
      const container = renderComponent({ value: relativeValue, isFullscreen: false, hideQuickRanges: true });
      expect(container.queryByLabelText(/timepicker from field/i)).toBeInTheDocument();
    });

    it('renders without timezone picker', () => {
      const container = renderComponent({ value: absoluteValue, hideTimeZone: true });
      expect(container.queryByText(/coordinated universal time/i)).not.toBeInTheDocument();
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
}: {
  value: TimeRange;
  isFullscreen?: boolean;
  showHistory?: boolean;
  history?: TimeRange[];
  hideQuickRanges?: boolean;
  hideTimeZone?: boolean;
}): RenderResult {
  return render(
    <TimePickerContentWithScreenSize
      onChangeTimeZone={noop}
      onChange={noop}
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
