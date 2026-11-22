import { HttpResponse, delay, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setTimeIntervalsList } from 'app/features/alerting/unified/mocks/server/configure';

import { TimeIntervalsSelect } from './TimeIntervalsSelect';

const server = setupMswServer();

const TIME_INTERVALS_URL = '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/:namespace/timeintervals';

describe('TimeIntervalsSelect', () => {
  it('lists imported intervals as unselectable, with an explanation', async () => {
    setTimeIntervalsList([{ name: 'weekends' }, { name: 'imported-interval', provenance: 'converted_prometheus' }]);
    const onChange = jest.fn();
    const { user } = render(<TimeIntervalsSelect value={[]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('weekends')).toBeInTheDocument();
    expect(screen.getByText(/imported from an external alertmanager/i)).toBeInTheDocument();
    await user.click(screen.getByText('imported-interval'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports the picked interval names', async () => {
    setTimeIntervalsList([{ name: 'weekends' }]);
    const onChange = jest.fn();
    const { user } = render(<TimeIntervalsSelect value={[]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('weekends'));

    expect(onChange).toHaveBeenCalledWith(['weekends']);
  });

  it('still renders the current selection when the list fails to load', async () => {
    server.use(http.get(TIME_INTERVALS_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<TimeIntervalsSelect value={['weekends']} onChange={jest.fn()} />);

    expect(await screen.findByText('weekends')).toBeInTheDocument();
  });

  it('shows that the list is loading rather than empty', async () => {
    server.use(
      http.get(TIME_INTERVALS_URL, async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [] });
      })
    );
    const { user } = render(<TimeIntervalsSelect value={[]} onChange={jest.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText(/loading options/i)).toBeInTheDocument();
    expect(screen.queryByText(/no options found/i)).not.toBeInTheDocument();
  });

  it('does not request the list while disabled', async () => {
    const requested = jest.fn();
    server.use(
      http.get(TIME_INTERVALS_URL, () => {
        requested();
        return HttpResponse.json({ items: [] });
      })
    );

    render(<TimeIntervalsSelect value={[]} onChange={jest.fn()} disabled />);

    expect(await screen.findByText('Select time intervals...')).toBeInTheDocument();
    expect(requested).not.toHaveBeenCalled();
  });
});
