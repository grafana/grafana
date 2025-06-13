import { render, screen } from 'test/test-utils';

import { setupMockServer } from '@grafana/test-utils/server';

import { mockCombinedRule } from '../../../mocks';
import { alertingFactory } from '../../../mocks/server/db';
import { setupDataSources } from '../../../testSetup/datasources';
import { RECEIVER_NAME, listContactPointsScenario } from '../ContactPointLink.test.scenario';

import { Details } from './Details';

const server = setupMockServer();

beforeAll(() => {
  setupDataSources();
});

describe('render details tab', () => {
  beforeEach(() => {
    // we'll re-use the scenario from the contact point link component
    server.use(...listContactPointsScenario);
  });

  it('should show paused rule', () => {
    const rule = mockCombinedRule({
      rulerRule: alertingFactory.ruler.grafana.recordingRule.build({
        grafana_alert: {
          is_paused: true,
        },
      }),
    });

    render(<Details rule={rule} />);
    expect(screen.getByText(/Alert evaluation currently paused/i)).toBeInTheDocument();
  });

  it('should render simplified routing information', async () => {
    const rule = mockCombinedRule({
      rulerRule: alertingFactory.ruler.grafana.alertingRule.build({
        grafana_alert: {
          notification_settings: {
            receiver: RECEIVER_NAME,
            active_time_intervals: ['ati1', 'ati2'],
            group_by: ['g1', 'g2'],
            group_interval: '6m',
            group_wait: '15m',
            repeat_interval: '6h',
            mute_time_intervals: ['mti1', 'mti2'],
          },
        },
      }),
    });

    render(<Details rule={rule} />);

    // wait for the reciever link to be loaded
    expect(await screen.findByRole('link', { name: RECEIVER_NAME })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'ati1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ati2' })).toBeInTheDocument();

    expect(screen.getByText(/g1, g2/i)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'mti1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'mti2' })).toBeInTheDocument();

    expect(screen.getByText(/6m/i)).toBeInTheDocument();
    expect(screen.getByText(/15m/i)).toBeInTheDocument();
    expect(screen.getByText(/6h/i)).toBeInTheDocument();
  });
});
