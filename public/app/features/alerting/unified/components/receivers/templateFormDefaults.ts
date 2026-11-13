import { addMinutes } from 'date-fns/addMinutes';
import { subDays } from 'date-fns/subDays';
import { subHours } from 'date-fns/subHours';

import { type TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

export interface TemplateFormValues {
  title: string;
  content: string;
}

export const defaults: TemplateFormValues = Object.freeze({
  title: '',
  content: '',
});

const defaultPayload: TestTemplateAlert[] = [
  {
    status: 'firing',
    annotations: {
      summary: 'Instance instance1 has been down for more than 5 minutes',
      description:
        'The instance instance1 has been unreachable for more than 5 minutes, indicating a potential service outage.',
    },
    labels: {
      alertname: 'InstanceDown',
      instance: 'instance1',
      severity: 'critical',
      service: 'service1',
      environment: 'production',
    },
    startsAt: subDays(new Date(), 1).toISOString(),
    endsAt: addMinutes(new Date(), 5).toISOString(),
    fingerprint: 'a5331f0d5a9d81d4',
    generatorURL: 'http://grafana.com/alerting/grafana/cdeqmlhvflz40f/view',
  },
  {
    status: 'resolved',
    annotations: {
      summary: 'CPU usage above 90%',
      description:
        'The CPU usage on instance1 has exceeded 90% for an extended period, which may indicate performance issues or resource constraints.',
    },
    labels: {
      alertname: 'CpuUsage',
      instance: 'instance1',
      severity: 'warning',
      service: 'service1',
      environment: 'dev',
    },
    startsAt: subHours(new Date(), 4).toISOString(),
    endsAt: new Date().toISOString(),
    fingerprint: 'b77d941310f9d381',
    generatorURL: 'http://grafana.com/alerting/grafana/oZSMdGj7z/view',
  },
];

export const defaultPayloadString = JSON.stringify(defaultPayload, null, 2);
