import { type Chain } from '../../api/chainsApi';

export const chainFixtures: Record<string, Chain> = {
  'usage-chain': {
    id: 'usage-chain',
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
