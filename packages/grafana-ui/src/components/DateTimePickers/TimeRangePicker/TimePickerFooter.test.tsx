import { render, screen } from '@testing-library/react';

import { TimePickerFooter } from './TimePickerFooter';

// Fixed timestamp (northern-hemisphere winter) so DST-dependent abbreviations
// and offsets are deterministic.
const JAN_15_2026 = Date.UTC(2026, 0, 15);

describe('TimePickerFooter', () => {
  // moment-timezone reported numeric abbreviations (e.g. '-03') for these
  // zones, which getTimeZoneInfo blanked out; easy-tz curates the
  // conventional ones.
  it.each([
    ['America/Sao_Paulo', 'Sao Paulo', 'BRT', 'UTC-03:00'],
    ['Europe/Moscow', 'Moscow', 'MSK', 'UTC+03:00'],
  ])('shows the abbreviation for %s', (timeZone, title, abbreviation, offset) => {
    render(<TimePickerFooter timeZone={timeZone} timestamp={JAN_15_2026} onChangeTimeZone={jest.fn()} />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(abbreviation)).toBeInTheDocument();
    expect(screen.getByText(offset)).toBeInTheDocument();
  });

  it('shows the canonical title for a persisted legacy spelling', () => {
    render(<TimePickerFooter timeZone="Asia/Calcutta" timestamp={JAN_15_2026} onChangeTimeZone={jest.fn()} />);

    expect(screen.getByText('Kolkata')).toBeInTheDocument();
    expect(screen.getByText('IST')).toBeInTheDocument();
    expect(screen.getByText('UTC+05:30')).toBeInTheDocument();
  });

  it('renders nothing for unknown zone names', () => {
    const { container } = render(
      <TimePickerFooter timeZone="Foo/Bar" timestamp={JAN_15_2026} onChangeTimeZone={jest.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
