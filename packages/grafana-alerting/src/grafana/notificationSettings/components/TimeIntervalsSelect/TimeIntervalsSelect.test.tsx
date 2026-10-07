import { HttpResponse } from 'msw';

import { setupMockServer } from '@grafana/test-utils/server';
import { Field } from '@grafana/ui';

import { render, screen } from '../../../../../tests/test-utils';
import { ListTimeIntervalApiResponseFactory } from '../../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listTimeIntervalHandler } from '../../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';

import { TimeIntervalsSelect } from './TimeIntervalsSelect';

const server = setupMockServer();

beforeEach(() => {
  server.use(
    listTimeIntervalHandler(
      ListTimeIntervalApiResponseFactory.build({
        items: [{ metadata: { name: 'weekends' } } as never, { metadata: { name: 'business-hours' } } as never],
      })
    )
  );
});

describe('TimeIntervalsSelect', () => {
  it('offers the available time intervals and emits the selected names', async () => {
    const onChange = jest.fn();
    const { user } = render(<TimeIntervalsSelect value={[]} onChange={onChange} aria-label="Intervals" />);

    await user.click(screen.getByLabelText('Intervals'));
    await user.click(await screen.findByText('weekends'));

    expect(onChange).toHaveBeenCalledWith(['weekends']);
  });

  it('shows the selected names', async () => {
    render(<TimeIntervalsSelect value={['business-hours']} onChange={jest.fn()} aria-label="Intervals" />);

    expect(await screen.findByText('business-hours')).toBeInTheDocument();
  });

  it('is reachable by the label of a wrapping Field', () => {
    render(
      <Field label="Mute timings">
        <TimeIntervalsSelect value={[]} onChange={jest.fn()} />
      </Field>
    );

    expect(screen.getByLabelText('Mute timings')).toBeInTheDocument();
  });

  it('says so in the dropdown when the time intervals could not be loaded', async () => {
    server.use(listTimeIntervalHandler(() => new HttpResponse(null, { status: 500 })));
    const { user } = render(<TimeIntervalsSelect value={[]} onChange={jest.fn()} aria-label="Intervals" />);

    await user.click(screen.getByLabelText('Intervals'));

    expect(await screen.findByText('Could not load time intervals')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<TimeIntervalsSelect value={[]} onChange={jest.fn()} aria-label="Intervals" disabled />);

    expect(screen.getByLabelText('Intervals')).toBeDisabled();
  });
});
