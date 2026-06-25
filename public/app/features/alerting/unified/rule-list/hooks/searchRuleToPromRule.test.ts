import { prometheusRuleType } from '../../utils/rules';

import {
  type AlertRuleSearchHit,
  type RecordingRuleSearchHit,
  mapAlertRuleHitToDTO,
  mapRecordingRuleHitToDTO,
  mapRuleHitToDTO,
} from './searchRuleToPromRule';

const alertHit: AlertRuleSearchHit = {
  type: 'alertrule',
  name: 'rule-uid-1',
  title: 'High latency',
  folder: 'folder-uid-1',
  group: 'my-group',
  interval: '1m',
  paused: true,
  labels: { severity: 'critical' },
  annotations: { summary: 'latency is high' },
  datasourceUIDs: ['prom-uid'],
  receiver: 'oncall',
};

const recordingHit: RecordingRuleSearchHit = {
  type: 'recordingrule',
  name: 'rule-uid-2',
  title: 'job:requests:rate5m',
  folder: 'folder-uid-2',
  group: 'recordings',
  labels: { team: 'backend' },
  datasourceUIDs: ['prom-uid'],
  targetDatasourceUID: 'prom-uid',
};

describe('searchRuleToPromRule', () => {
  it('maps an alert-rule hit to a Grafana alerting DTO that passes the type guard', () => {
    const dto = mapAlertRuleHitToDTO(alertHit);

    expect(prometheusRuleType.grafana.alertingRule(dto)).toBe(true);
    expect(dto.uid).toBe('rule-uid-1');
    expect(dto.name).toBe('High latency');
    expect(dto.folderUid).toBe('folder-uid-1');
    expect(dto.isPaused).toBe(true);
    expect(dto.labels).toEqual({ severity: 'critical' });
    expect(dto.annotations).toEqual({ summary: 'latency is high' });
    expect(dto.queriedDatasourceUIDs).toEqual(['prom-uid']);
    expect(dto.notificationSettings).toEqual({ receiver: 'oncall' });
  });

  it('maps a recording-rule hit to a Grafana recording DTO that passes the type guard', () => {
    const dto = mapRecordingRuleHitToDTO(recordingHit);

    expect(prometheusRuleType.grafana.recordingRule(dto)).toBe(true);
    expect(prometheusRuleType.grafana.alertingRule(dto)).toBe(false);
    expect(dto.uid).toBe('rule-uid-2');
    expect(dto.name).toBe('job:requests:rate5m');
    expect(dto.folderUid).toBe('folder-uid-2');
    expect(dto.queriedDatasourceUIDs).toEqual(['prom-uid']);
  });

  it('omits notificationSettings when the hit has no receiver', () => {
    const dto = mapAlertRuleHitToDTO({ ...alertHit, receiver: undefined });
    expect(dto.notificationSettings).toBeUndefined();
  });

  it('dispatches on the type discriminator', () => {
    expect(prometheusRuleType.grafana.alertingRule(mapRuleHitToDTO(alertHit))).toBe(true);
    expect(prometheusRuleType.grafana.recordingRule(mapRuleHitToDTO(recordingHit))).toBe(true);
  });

  it('defaults missing optional collections', () => {
    const dto = mapAlertRuleHitToDTO({ type: 'alertrule', name: 'u', title: 't', folder: 'f' });
    expect(dto.labels).toEqual({});
    expect(dto.annotations).toEqual({});
    expect(dto.queriedDatasourceUIDs).toEqual([]);
    expect(dto.isPaused).toBe(false);
  });
});
