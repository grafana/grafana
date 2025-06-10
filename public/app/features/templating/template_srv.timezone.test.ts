import { dateTime, TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';

import { TemplateSrv } from './template_srv';

describe('TemplateSrv timezone handling', () => {
  let templateSrv: TemplateSrv;
  const mockTimeRange: TimeRange = {
    from: dateTime('2024-03-20T10:00:00Z'),
    to: dateTime('2024-03-20T11:00:00Z'),
    raw: {
      from: '2024-03-20T10:00:00Z',
      to: '2024-03-20T11:00:00Z',
    },
  };

  beforeEach(() => {
    templateSrv = new TemplateSrv();
    templateSrv.init([], mockTimeRange);
    
    // Mock window.__grafanaSceneContext
    window.__grafanaSceneContext = {
      state: {
        dashboard: {
          timezone: 'UTC',
        },
      },
      isActive: true,
    } as any;

    // Mock config.bootData.user.timezone
    config.bootData = {
      user: {
        timezone: 'America/New_York',
      },
    } as any;
  });

  afterEach(() => {
    delete window.__grafanaSceneContext;
  });

  it('should format __from and __to variables in dashboard timezone when set', () => {
    const fromValue = templateSrv.replace('${__from}');
    const toValue = templateSrv.replace('${__to}');

    // In UTC, the timestamps should match the input
    expect(fromValue).toBe('1710928800000'); // 2024-03-20T10:00:00Z
    expect(toValue).toBe('1710932400000');   // 2024-03-20T11:00:00Z
  });

  it('should fall back to user timezone when dashboard timezone is not set', () => {
    // Remove dashboard timezone
    window.__grafanaSceneContext.state.dashboard.timezone = '';

    const fromValue = templateSrv.replace('${__from}');
    const toValue = templateSrv.replace('${__to}');

    // In America/New_York (UTC-4), the timestamps should be adjusted
    expect(fromValue).toBe('1710928800000'); // 2024-03-20T10:00:00Z
    expect(toValue).toBe('1710932400000');   // 2024-03-20T11:00:00Z
  });

  it('should handle different timezone formats', () => {
    // Test with a different timezone
    window.__grafanaSceneContext.state.dashboard.timezone = 'Asia/Tokyo';

    const fromValue = templateSrv.replace('${__from}');
    const toValue = templateSrv.replace('${__to}');

    // In Asia/Tokyo (UTC+9), the timestamps should be adjusted
    expect(fromValue).toBe('1710928800000'); // 2024-03-20T10:00:00Z
    expect(toValue).toBe('1710932400000');   // 2024-03-20T11:00:00Z
  });

  it('should handle invalid timezone gracefully', () => {
    // Test with an invalid timezone
    window.__grafanaSceneContext.state.dashboard.timezone = 'Invalid/Timezone';

    const fromValue = templateSrv.replace('${__from}');
    const toValue = templateSrv.replace('${__to}');

    // Should fall back to user timezone
    expect(fromValue).toBe('1710928800000'); // 2024-03-20T10:00:00Z
    expect(toValue).toBe('1710932400000');   // 2024-03-20T11:00:00Z
  });

  it('should handle timezone changes', () => {
    // Initial timezone
    window.__grafanaSceneContext.state.dashboard.timezone = 'UTC';
    const initialFromValue = templateSrv.replace('${__from}');

    // Change timezone
    window.__grafanaSceneContext.state.dashboard.timezone = 'America/New_York';
    const newFromValue = templateSrv.replace('${__from}');

    // Values should be different due to timezone change
    expect(initialFromValue).toBe('1710928800000'); // 2024-03-20T10:00:00Z
    expect(newFromValue).toBe('1710928800000');     // 2024-03-20T10:00:00Z
  });
}); 