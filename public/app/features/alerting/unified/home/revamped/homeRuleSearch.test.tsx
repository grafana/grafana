import { render, screen, waitFor } from 'test/test-utils';

import { mockRuleSearch } from '../../gma-rule-list/mocks/handlers';
import { setupMswServer } from '../../mockApi';

import { homeRuleSearchAPI } from './homeRuleSearch';

setupMswServer();

function alertItem(index: number) {
  return {
    resource: { group: 'rules.alerting.grafana.app', kind: 'AlertRule', name: `rule-${index}`, resource: 'alertrules' },
    fields: { title: `Rule ${index}`, folder: 'f', paused: false, health: 'OK', totalsHealthy: 1 },
  };
}

/** Shows what the hook returned, as JSON, so a test can read it from the page. */
function Probe() {
  const { data, error } = homeRuleSearchAPI.useGetHomeRuleHitsQuery();
  return <pre data-testid="result">{JSON.stringify(data ?? (error ? { error: true } : null))}</pre>;
}

async function readResult() {
  render(<Probe />);
  await waitFor(() => expect(screen.getByTestId('result')).not.toHaveTextContent('null'));
  return JSON.parse(screen.getByTestId('result').textContent ?? 'null');
}

describe('the home page rule search', () => {
  it('follows the continue token until every page is read, then adds the recording rules', async () => {
    const tokens: Array<string | undefined> = [];
    mockRuleSearch('alert', (body, call) => {
      tokens.push(body.continue);
      return call === 1
        ? { items: [alertItem(1), alertItem(2)], metadata: { continue: 'page-2', totalHits: 3 } }
        : { items: [alertItem(3)], metadata: { totalHits: 3 } };
    });
    mockRuleSearch('recording', () => ({
      items: [
        {
          resource: {
            group: 'rules.alerting.grafana.app',
            kind: 'RecordingRule',
            name: 'rec',
            resource: 'recordingrules',
          },
          fields: { title: 'Recorded', paused: true },
        },
      ],
      metadata: { totalHits: 1 },
    }));

    const data = await readResult();

    expect(tokens).toEqual([undefined, 'page-2']);
    expect(data.alert.map((hit: { uid: string }) => hit.uid)).toEqual(['rule-1', 'rule-2', 'rule-3']);
    expect(data.recording.map((hit: { uid: string; paused: boolean }) => [hit.uid, hit.paused])).toEqual([
      ['rec', true],
    ]);
    expect(data.hasMore).toBe(false);
  });

  it('stops at 2,000 rules and says there are more', async () => {
    mockRuleSearch('alert', (_body, call) => ({
      items: Array.from({ length: 500 }, (_, index) => alertItem(call * 1000 + index)),
      metadata: { continue: `page-${call + 1}`, totalHits: 9000, totalHitsRelation: 'lte' },
    }));
    mockRuleSearch('recording', () => ({ items: [], metadata: { totalHits: 0 } }));

    const data = await readResult();

    expect(data.alert).toHaveLength(2000);
    expect(data.hasMore).toBe(true);
  });

  it('asks for only the fields the page reads, in pages of 500, with no filter', async () => {
    const bodies: unknown[] = [];
    mockRuleSearch('alert', (body) => {
      bodies.push(body);
      return { items: [], metadata: { totalHits: 0 } };
    });
    mockRuleSearch('recording', () => ({ items: [], metadata: { totalHits: 0 } }));

    await readResult();

    expect(bodies).toEqual([
      {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        fields: [
          'title',
          'folder',
          'paused',
          'state',
          'health',
          'lastError',
          'labels',
          'totalsHealthy',
          'totalsFiring',
          'totalsPending',
          'totalsRecovering',
          'totalsNoData',
          'totalsError',
        ],
        sort: [{ field: 'title', direction: 'asc' }],
        limit: 500,
      },
    ]);
  });
});
