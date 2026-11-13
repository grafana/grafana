import { HttpResponse, http } from 'msw';
import { render, screen, within } from 'test/test-utils';

import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';

import { MissedEvaluationsTable } from './MissedEvaluationsTable';
import { getDefaultHomeRange } from './homeRange';

setupMswServer();

function frame(value: number, labels: Record<string, string> = {}) {
  return {
    schema: {
      fields: [
        { name: 'Time', type: 'time' },
        { name: 'Value', type: 'number', labels },
      ],
    },
    data: { values: [[0], [value]] },
  };
}

function setMissed(frames: Record<string, Array<ReturnType<typeof frame>>>) {
  server.use(
    http.post('/api/ds/query', async ({ request }) => {
      const body = (await request.json()) as { queries: Array<{ refId: string }> };
      return HttpResponse.json({
        results: Object.fromEntries(
          body.queries.map(({ refId }) => [refId, { status: 200, frames: frames[refId] ?? [] }])
        ),
      });
    })
  );
}

describe('MissedEvaluationsTable', () => {
  it('ranks rules by missed evaluations over the range, with their share, linking to the rule list by title', async () => {
    // Over the 7 day default range, 604,800 seconds: 0.0001/s is about 60 missed.
    setMissed({
      topMissed: [frame(0.0001, { rule_title: 'CPU high' }), frame(0.00005, { rule_title: 'Disk full' })],
      totalMissed: [frame(0.0002)],
    });

    render(<MissedEvaluationsTable range={getDefaultHomeRange()} />);

    const table = await screen.findByRole('region', { name: 'Rules that missed the most' });
    const rows = (await within(table).findAllByRole('row')).slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['1CPU high6050%', '2Disk full3025%']);
    expect(within(rows[0]).getByRole('link', { name: 'CPU high' })).toHaveAttribute(
      'href',
      '/alerting/list?search=rule%3A%22CPU+high%22'
    );
  });

  it('says so when no rule missed an evaluation in the range', async () => {
    setMissed({});

    render(<MissedEvaluationsTable range={getDefaultHomeRange()} />);

    expect(await screen.findByText('No rule missed an evaluation in this time range.')).toBeInTheDocument();
  });
});
