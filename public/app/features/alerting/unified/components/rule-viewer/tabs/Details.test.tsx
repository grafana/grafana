import { render, screen } from 'test/test-utils';

import { mockCombinedRule } from '../../../mocks';
import { alertingFactory } from '../../../mocks/server/db';
import { setupDataSources } from '../../../testSetup/datasources';

import { Details } from './Details';

beforeAll(() => {
  setupDataSources();
});

describe('render details tab', () => {
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
});
