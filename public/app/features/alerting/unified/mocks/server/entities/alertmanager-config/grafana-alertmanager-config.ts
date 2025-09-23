import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

const grafanaAlertmanagerConfig: AlertManagerCortexConfig = {
  template_files: {
    'slack-template': '{{ define "slack-template" }} Custom slack template {{ end }}',
    'custom-email': '{{ define "custom-email" }}  Custom email template {{ end }}',
    'provisioned-template': '{{ define "provisioned-template" }}  Custom provisioned template {{ end }}',
    'template with spaces': '{{ define "template with spaces" }}  Custom template with spaces in the name {{ end }}',
    'misconfigured-template':
      '{{ define "misconfigured template" }} Template that is defined in template_files but not templates {{ end }}',
    'misconfigured and provisioned':
      '{{ define "misconfigured and provisioned template" }} Provisioned template that is defined in template_files but not templates {{ end }}',
  },
  template_file_provenances: {
    'provisioned-template': 'api',
    'misconfigured and provisioned': 'api',
  },
  alertmanager_config: {
    route: {
      group_by: ['alertname'],
      receiver: 'grafana-default-email',
      routes: [
        {
          match: {
            sub1matcher1: 'sub1value1',
            sub1matcher2: 'sub1value2',
          },
          match_re: {
            sub1matcher3: 'sub1value3',
            sub1matcher4: 'sub1value4',
          },
          group_by: ['sub1group1', 'sub1group2'],
          receiver: 'a-receiver',
          continue: true,
          group_wait: '3s',
          group_interval: '2m',
          repeat_interval: '3m',
          routes: [
            {
              match: {
                sub1sub1matcher1: 'sub1sub1value1',
                sub1sub1matcher2: 'sub1sub1value2',
              },
              match_re: {
                sub1sub1matcher3: 'sub1sub1value3',
                sub1sub1matcher4: 'sub1sub1value4',
              },
              group_by: ['sub1sub1group1', 'sub1sub1group2'],
              receiver: 'another-receiver',
            },
            {
              match: {
                sub1sub2matcher1: 'sub1sub2value1',
                sub1sub2matcher2: 'sub1sub2value2',
              },
              match_re: {
                sub1sub2matcher3: 'sub1sub2value3',
                sub1sub2matcher4: 'sub1sub2value4',
              },
              group_by: ['sub1sub2group1', 'sub1sub2group2'],
              receiver: 'another-receiver',
            },
          ],
        },
        {
          match: {
            sub2matcher1: 'sub2value1',
            sub2matcher2: 'sub2value2',
          },
          match_re: {
            sub2matcher3: 'sub2value3',
            sub2matcher4: 'sub2value4',
          },
          receiver: 'another-receiver',
        },
        {
          receiver: 'provisioned-contact-point',
        },
      ],
    },
    receivers: [
      {
        name: 'grafana-default-email',
        grafana_managed_receiver_configs: [
          {
            uid: 'xeKQrBrnk',
            name: 'grafana-default-email',
            type: 'email',
            disableResolveMessage: false,
            settings: {
              addresses: 'gilles.demey@grafana.com',
              singleEmail: false,
            },
            secureFields: {},
          },
        ],
      },
      {
        name: 'provisioned-contact-point',
        grafana_managed_receiver_configs: [
          {
            uid: 's8SdCVjnk',
            name: 'provisioned-contact-point',
            type: 'email',
            disableResolveMessage: false,
            settings: {
              addresses: 'gilles.demey@grafana.com',
              singleEmail: false,
            },
            secureFields: {},
            provenance: 'api',
          },
        ],
      },
      {
        name: 'lotsa-emails',
        grafana_managed_receiver_configs: [
          {
            uid: 'af306c96-35a2-4d6e-908a-4993e245dbb2',
            name: 'lotsa-emails',
            type: 'email',
            disableResolveMessage: false,
            settings: {
              addresses:
                'gilles.demey+1@grafana.com, gilles.demey+2@grafana.com, gilles.demey+3@grafana.com, gilles.demey+4@grafana.com',
              singleEmail: false,
              message: '{{ template "slack-template" . }}',
              subject: 'some custom value',
            },
            secureFields: {},
          },
        ],
      },
      {
        name: 'Slack with multiple channels',
        grafana_managed_receiver_configs: [
          {
            uid: 'c02ad56a-31da-46b9-becb-4348ec0890fd',
            name: 'Slack with multiple channels',
            type: 'slack',
            disableResolveMessage: false,
            settings: {
              recipient: 'test-alerts',
            },
            secureFields: {
              token: true,
            },
          },
          {
            uid: 'b286a3be-f690-49e2-8605-b075cbace2df',
            name: 'Slack with multiple channels',
            type: 'slack',
            disableResolveMessage: false,
            settings: {
              recipient: 'test-alerts2',
            },
            secureFields: {
              token: true,
            },
          },
        ],
      },
      {
        name: 'OnCall Conctact point',
        grafana_managed_receiver_configs: [
          {
            name: 'Oncall-integration',
            type: 'oncall',
            settings: {
              url: 'https://oncall-endpoint.example.com',
            },
            disableResolveMessage: false,
          },
        ],
      },
    ],
    templates: ['slack-template', 'custom-email', 'provisioned-template', 'template with spaces'],
    time_intervals: [
      {
        name: 'Some interval',
        time_intervals: [],
      },
      {
        name: 'A provisioned interval',
        time_intervals: [],
      },
    ],
    mute_time_intervals: [],
  },
} as const;

export default grafanaAlertmanagerConfig;
