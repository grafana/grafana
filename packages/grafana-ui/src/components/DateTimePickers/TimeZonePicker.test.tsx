import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { TimeZonePicker } from './TimeZonePicker';

// Fixed timestamp (northern-hemisphere winter) so DST-dependent abbreviations
// and offsets are deterministic.
const JAN_15_2026 = Date.UTC(2026, 0, 15);

describe('TimeZonePicker', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(JAN_15_2026);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('displays the title of the selected time zone', () => {
    render(<TimeZonePicker value="America/Chicago" onChange={jest.fn()} />);
    expect(screen.getByText('Chicago')).toBeInTheDocument();
  });

  it('filters by city name and renders abbreviation and offset for the match', async () => {
    render(<TimeZonePicker onChange={jest.fn()} />);

    await userEvent.type(screen.getByRole('combobox'), 'chicago');

    const option = await screen.findByTestId(selectors.components.Select.option);
    expect(option).toHaveTextContent('Chicago');
    expect(option).toHaveTextContent('CST');
    expect(option).toHaveTextContent('UTC-06:00');
  });

  it('filters by abbreviation', async () => {
    render(<TimeZonePicker onChange={jest.fn()} />);

    await userEvent.type(screen.getByRole('combobox'), 'aedt');

    expect(await screen.findByText('Sydney')).toBeInTheDocument();
  });

  it('finds a zone by its alternate spelling', async () => {
    render(<TimeZonePicker onChange={jest.fn()} />);

    // Depending on the runtime's ICU, the zone is listed as either
    // Asia/Kolkata or the legacy Asia/Calcutta; searching the canonical
    // spelling must find it either way.
    await userEvent.type(screen.getByRole('combobox'), 'kolkata');

    expect(await screen.findByText(/^(Calcutta|Kolkata)$/)).toBeInTheDocument();
  });

  it('does not match on UTC offset', async () => {
    render(<TimeZonePicker onChange={jest.fn()} />);

    await userEvent.type(screen.getByRole('combobox'), '-06:00');

    expect(await screen.findByText(/no options found/i)).toBeInTheDocument();
    expect(screen.queryByText('Chicago')).not.toBeInTheDocument();
  });

  it('calls onChange with the IANA zone name of the selected option', async () => {
    const onChange = jest.fn();
    render(<TimeZonePicker onChange={onChange} />);

    await userEvent.type(screen.getByRole('combobox'), 'stockholm');
    await userEvent.click(await screen.findByText('Stockholm'));

    expect(onChange).toHaveBeenCalledWith('Europe/Stockholm');
  });

  describe('with internal time zones', () => {
    it('lists Default, Browser Time and UTC at the top', async () => {
      render(<TimeZonePicker onChange={jest.fn()} includeInternal={true} />);

      await userEvent.click(screen.getByRole('combobox'));

      const options = await screen.findAllByTestId(selectors.components.Select.option);
      expect(options[0]).toHaveTextContent('Default');
      expect(options[1]).toHaveTextContent('Browser Time');
      expect(options[2]).toHaveTextContent('Coordinated Universal Time');
    });

    it('shows the UTC, GMT abbreviation for the UTC option', async () => {
      render(<TimeZonePicker onChange={jest.fn()} includeInternal={true} />);

      await userEvent.type(screen.getByRole('combobox'), 'coordinated');

      const option = await screen.findByTestId(selectors.components.Select.option);
      expect(option).toHaveTextContent('Coordinated Universal Time');
      expect(option).toHaveTextContent('UTC, GMT');
      expect(option).toHaveTextContent('UTC+00:00');
    });

    it('calls onChange with the internal utc zone', async () => {
      const onChange = jest.fn();
      render(<TimeZonePicker onChange={onChange} includeInternal={true} />);

      await userEvent.type(screen.getByRole('combobox'), 'coordinated');
      await userEvent.click(await screen.findByText('Coordinated Universal Time'));

      expect(onChange).toHaveBeenCalledWith('utc');
    });
  });
});
