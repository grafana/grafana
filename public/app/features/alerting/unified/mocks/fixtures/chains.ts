import { type Chain, type ChainSummary } from '../../api/chainsApi';

export const USAGE_CHAIN_ID = 'usage-chain';
export const USAGE_CHAIN_FOLDER_TITLE = 'GrafanaCloud/Usage Alerts';

export const chainFixtures: Record<string, Chain> = {
  [USAGE_CHAIN_ID]: {
    id: USAGE_CHAIN_ID,
    mode: 'Sequential',
    interval: '1m',
    steps: [
      {
        type: 'recording',
        state: 'recording',
        name: 'hosted_grafana:pause_events:10m',
        sub: 'Aggregates 10-minute pause events',
      },
      {
        type: 'alert',
        state: 'normal',
        name: 'Attributed Metrics Usage [namespace=sum_by]: 10% over 12,000,000 series',
        sub: 'Provisioned by Cost Management & Billing',
      },
      {
        type: 'alert',
        state: 'normal',
        name: 'Attributed Metrics Usage [namespace=AWS/EC2]: 1% over 15,000 series',
        sub: 'Provisioned by Cost Management & Billing',
      },
      {
        type: 'alert',
        state: 'normal',
        name: 'Attributed Logs Usage [namespace=prod]: 5% over 200 GiB',
      },
    ],
  },
};

export const chainSummaries: ChainSummary[] = Object.values(chainFixtures).map(({ id }) => ({ id }));

// Demo config for the POC: tags the first N rules encountered in the list with
// sequential positions of the chain, regardless of rule name. A real backend
// would return memberships keyed by a stable rule UID.
export const DEMO_CHAIN_ID = USAGE_CHAIN_ID;
export const DEMO_CHAIN_SIZE = chainFixtures[USAGE_CHAIN_ID].steps.length;
