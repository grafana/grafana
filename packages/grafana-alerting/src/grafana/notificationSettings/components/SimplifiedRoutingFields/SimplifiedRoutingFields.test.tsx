import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';
import { ListTimeIntervalApiResponseFactory } from '../../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listTimeIntervalHandler } from '../../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';

import { SimplifiedRoutingFields } from './SimplifiedRoutingFields';

const server = setupMockServer();

beforeEach(() => {
  server.use(listTimeIntervalHandler(ListTimeIntervalApiResponseFactory.build({ items: [] })));
});

function renderField(props: Partial<React.ComponentProps<typeof SimplifiedRoutingFields>> = {}) {
  return render(<SimplifiedRoutingFields value={{}} onChange={jest.fn()} {...props} />);
}

describe('SimplifiedRoutingFields', () => {
  it('is collapsed by default and expands on click', async () => {
    const { user } = renderField();

    expect(screen.queryByLabelText(/mute timings/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /muting, grouping and timings/i }));

    expect(await screen.findByLabelText(/mute timings/i)).toBeInTheDocument();
  });

  it('starts expanded when the value already has an override or mute timings set', () => {
    renderField({ value: { muteTimeIntervals: ['weekends'] } });

    expect(screen.getByLabelText(/mute timings/i)).toBeInTheDocument();
  });

  it('starts expanded when the value already has active timings set', () => {
    renderField({ value: { activeTimeIntervals: ['business-hours'] } });

    expect(screen.getByLabelText(/mute timings/i)).toBeInTheDocument();
  });

  it('lets the user edit mute and active timings directly, as multi-selects, with no toggle', async () => {
    server.use(
      listTimeIntervalHandler(
        ListTimeIntervalApiResponseFactory.build({
          items: [{ metadata: { name: 'weekends' } } as never, { metadata: { name: 'business-hours' } } as never],
        })
      )
    );
    const onChange = jest.fn();
    const { user } = renderField({ onChange });

    await user.click(screen.getByRole('button', { name: /muting, grouping and timings/i }));
    await user.click(await screen.findByLabelText(/mute timings/i));
    await user.click(await screen.findByText('weekends'));

    expect(onChange).toHaveBeenCalledWith({ muteTimeIntervals: ['weekends'] });
  });

  it('shows a grouping summary and hides GroupByField until "Override grouping" is toggled on', async () => {
    const { user } = renderField();

    await user.click(screen.getByRole('button', { name: /muting, grouping and timings/i }));

    expect(screen.getByText(/grouping:/i)).toBeInTheDocument();
    expect(screen.getByText(/grafana_folder, alertname/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^group by$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /override grouping/i }));

    expect(screen.queryByText(/grouping:/i)).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/^group by$/i)).toBeInTheDocument();
  });

  it('seeds group by with the required fields when override grouping is turned on empty', async () => {
    const onChange = jest.fn();
    const { user } = renderField({ onChange });

    await user.click(screen.getByRole('button', { name: /muting, grouping and timings/i }));
    await user.click(screen.getByRole('switch', { name: /override grouping/i }));

    expect(onChange).toHaveBeenCalledWith({ groupBy: ['grafana_folder', 'alertname'] });
  });

  it('clears groupBy when override grouping is turned back off', async () => {
    const onChange = jest.fn();
    // groupBy is already non-empty, so overrideGrouping starts true and the section is already
    // expanded - no need to (and must not) click the outer collapsible toggle first.
    const { user } = renderField({
      value: { groupWait: '30s', groupBy: ['grafana_folder', 'alertname', 'team'] },
      onChange,
    });

    await user.click(screen.getByRole('switch', { name: /override grouping/i }));

    expect(onChange).toHaveBeenCalledWith({ groupWait: '30s', groupBy: undefined });
  });

  it('shows a timings summary and hides duration fields until "Override timings" is toggled on', async () => {
    const { user } = renderField();

    await user.click(screen.getByRole('button', { name: /muting, grouping and timings/i }));

    // The summary sentence is split across <strong> tags, so match its pieces rather than the
    // whole sentence as one text node.
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^group wait$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /override timings/i }));

    expect(screen.queryByText('30s')).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/^group wait$/i)).toBeInTheDocument();
  });

  it('clears the duration fields when override timings is turned back off', async () => {
    const onChange = jest.fn();
    const { user } = renderField({
      value: { muteTimeIntervals: ['weekends'], groupWait: '1m', groupInterval: '10m', repeatInterval: '6h' },
      onChange,
    });

    await user.click(screen.getByRole('switch', { name: /override timings/i }));

    expect(onChange).toHaveBeenCalledWith({
      muteTimeIntervals: ['weekends'],
      groupWait: undefined,
      groupInterval: undefined,
      repeatInterval: undefined,
    });
  });

  it('disables every interactive field and shows the reason when disabledReason is set', async () => {
    const { user } = renderField({ disabledReason: 'Select a contact point first' });

    await user.click(screen.getByRole('button', { name: /muting, grouping and timings/i }));

    expect(await screen.findByText('Select a contact point first')).toBeInTheDocument();
    expect(screen.getByLabelText(/mute timings/i)).toBeDisabled();
    expect(screen.getByRole('switch', { name: /override grouping/i })).toBeDisabled();
  });
});
