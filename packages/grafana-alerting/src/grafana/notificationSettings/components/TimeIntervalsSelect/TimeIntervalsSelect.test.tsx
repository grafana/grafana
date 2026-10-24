import { HttpResponse } from 'msw';
import { useState } from 'react';

import { setupMockServer } from '@grafana/test-utils/server';
import { Field } from '@grafana/ui';

import { render, screen } from '../../../../../tests/test-utils';
import {
  ListTimeIntervalApiResponseFactory,
  TimeIntervalFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listTimeIntervalHandler } from '../../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';

import { TimeIntervalsSelect } from './TimeIntervalsSelect';

const server = setupMockServer();

beforeEach(() => {
  server.use(
    listTimeIntervalHandler(
      ListTimeIntervalApiResponseFactory.build({
        items: [
          TimeIntervalFactory.build({ metadata: { name: 'uid-weekends' }, spec: { name: 'weekends' } }),
          TimeIntervalFactory.build({ metadata: { name: 'uid-business-hours' }, spec: { name: 'business-hours' } }),
        ],
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

  it('shows imported intervals as disabled, explaining that they must be promoted', async () => {
    server.use(
      listTimeIntervalHandler(
        ListTimeIntervalApiResponseFactory.build({
          items: [
            TimeIntervalFactory.build({ spec: { name: 'weekends' } }),
            TimeIntervalFactory.build({
              metadata: { annotations: { 'grafana.com/canUse': 'false' } },
              spec: { name: 'imported' },
            }),
          ],
        })
      )
    );
    const onChange = jest.fn();
    const { user } = render(<TimeIntervalsSelect value={[]} onChange={onChange} aria-label="Intervals" />);

    await user.click(screen.getByLabelText('Intervals'));
    await user.click(await screen.findByText('imported'));

    expect(screen.getByText(/promote it to use it here/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats an interval without the canUse annotation as unusable', async () => {
    // Built then stripped: factory params are deep-merged into the default annotation.
    const unannotated = TimeIntervalFactory.build({ spec: { name: 'unannotated' } });
    delete unannotated.metadata.annotations;
    server.use(listTimeIntervalHandler(ListTimeIntervalApiResponseFactory.build({ items: [unannotated] })));
    const onChange = jest.fn();
    const { user } = render(<TimeIntervalsSelect value={[]} onChange={onChange} aria-label="Intervals" />);

    await user.click(screen.getByLabelText('Intervals'));
    await user.click(await screen.findByText('unannotated'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers an interval created elsewhere when the select is mounted again', async () => {
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button onClick={() => setShown(!shown)}>toggle</button>
          {shown && <TimeIntervalsSelect value={[]} onChange={jest.fn()} aria-label="Intervals" />}
        </>
      );
    }
    const { user } = render(<Toggle />);
    await user.click(screen.getByLabelText('Intervals'));
    expect(await screen.findByText('weekends')).toBeInTheDocument();
    await user.click(screen.getByText('toggle'));

    server.use(
      listTimeIntervalHandler(
        ListTimeIntervalApiResponseFactory.build({
          items: [TimeIntervalFactory.build({ spec: { name: 'new-interval' } })],
        })
      )
    );
    await user.click(screen.getByText('toggle'));
    await user.click(screen.getByLabelText('Intervals'));

    expect(await screen.findByText('new-interval')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<TimeIntervalsSelect value={[]} onChange={jest.fn()} aria-label="Intervals" disabled />);

    expect(screen.getByLabelText('Intervals')).toBeDisabled();
  });
});
