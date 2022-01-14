import { ActiveCheck } from '../types';

export const activeCheckStub: ActiveCheck[] = [
  {
    details: [
      {
        description: 'root password is empty: The root password is empty',
        labels: {
          agent_id: 'pmm-server',
          agent_type: 'pmm-agent',
          alertname: 'pmm_agent_outdated',
          node_id: 'pmm-server',
          node_name: 'pmm-server',
          node_type: 'generic',
          service_name: 'sandbox-mysql.acme.com',
          severity: 'error',
          stt_check: '1',
        },
        silenced: false,
        readMoreUrl: 'https://example.com',
      },
      {
        description: 'MySQL is outdated: MySQL 5.1 is not the latest major version',
        labels: {
          agent_id: 'pmm-server',
          agent_type: 'pmm-agent',
          alertname: 'pmm_agent_outdated',
          node_id: 'pmm-server',
          node_name: 'pmm-server',
          node_type: 'generic',
          service_name: 'sandbox-mysql.acme.com',
          severity: 'notice',
          stt_check: '1',
        },
        silenced: false,
        readMoreUrl: '',
      },
    ],
    failed: [1, 0, 1],
    key: '0',
    name: 'sandbox-mysql.acme.com',
  },
  {
    details: [
      {
        description: 'pmm-server is outdated: PMM Server is not the latest major version',
        labels: {
          agent_id: 'pmm-server',
          agent_type: 'pmm-agent',
          alertname: 'pmm_agent_outdated',
          node_id: 'pmm-server',
          node_name: 'pmm-server',
          node_type: 'generic',
          service_name: 'pmm-server-postgresql',
          severity: 'warning',
          stt_check: '1',
        },
        silenced: false,
        readMoreUrl: '',
      },
    ],
    failed: [0, 1, 0],
    key: '1',
    name: 'pmm-server-postgresql',
  },
  {
    details: [
      {
        description: 'MongoDB password is weak: MongoDB admin password does not meet the complexity requirement',
        labels: {
          agent_id: 'pmm-server',
          agent_type: 'pmm-agent',
          alertname: 'pmm_agent_outdated',
          node_id: 'pmm-server',
          node_name: 'pmm-server',
          node_type: 'generic',
          service_name: 'mongodb-inst-rpl-1',
          severity: 'warning',
          stt_check: '1',
        },
        silenced: false,
        readMoreUrl: '',
      },
    ],
    failed: [0, 1, 0],
    key: '2',
    name: 'mongodb-inst-rpl-1',
  },
  {
    details: [
      {
        description: 'MongoDB password is weak: MongoDB admin password does not meet the complexity requirement',
        labels: {
          agent_id: 'pmm-server',
          agent_type: 'pmm-agent',
          alertname: 'pmm_agent_outdated',
          node_id: 'pmm-server',
          node_name: 'pmm-server',
          node_type: 'generic',
          service_name: 'mongodb-inst-rpl-2',
          severity: 'warning',
          stt_check: '1',
        },
        silenced: true,
        readMoreUrl: '',
      },
    ],
    failed: [0, 1, 0],
    key: '3',
    name: 'mongodb-inst-rpl-2',
  },
];

export const alertsStub = [
  {
    annotations: {
      description: 'The root password is empty',
      summary: 'root password is empty',
      read_more_url: 'https://example.com',
    },
    endsAt: '2020-04-20T14:39:03.575Z',
    fingerprint: '0d2242091d134c09',
    receivers: [
      {
        name: 'empty',
      },
    ],
    startsAt: '2020-04-20T12:08:48.946Z',
    status: {
      inhibitedBy: [],
      silencedBy: [],
      state: 'active',
    },
    updatedAt: '2020-04-20T14:34:03.575Z',
    labels: {
      stt_check: '1',
      agent_id: 'pmm-server',
      agent_type: 'pmm-agent',
      alertname: 'pmm_agent_outdated',
      node_id: 'pmm-server',
      node_name: 'pmm-server',
      service_name: 'sandbox-mysql.acme.com',
      node_type: 'generic',
      severity: 'error',
    },
  },
  {
    annotations: {
      description: 'MySQL 5.1 is not the latest major version',
      summary: 'MySQL is outdated',
      read_more_url: '',
    },
    endsAt: '2020-04-20T14:39:03.575Z',
    fingerprint: '0d2242091d134c09',
    receivers: [
      {
        name: 'empty',
      },
    ],
    startsAt: '2020-04-20T12:08:48.946Z',
    status: {
      inhibitedBy: [],
      silencedBy: [],
      state: 'active',
    },
    updatedAt: '2020-04-20T14:34:03.575Z',
    labels: {
      stt_check: '1',
      agent_id: 'pmm-server',
      agent_type: 'pmm-agent',
      alertname: 'pmm_agent_outdated',
      node_id: 'pmm-server',
      node_name: 'pmm-server',
      service_name: 'sandbox-mysql.acme.com',
      node_type: 'generic',
      severity: 'notice',
    },
  },
  {
    annotations: {
      description: 'PMM Server is not the latest major version',
      summary: 'pmm-server is outdated',
      read_more_url: '',
    },
    endsAt: '2020-04-20T14:39:03.575Z',
    fingerprint: '0d2242091d134c09',
    receivers: [
      {
        name: 'empty',
      },
    ],
    startsAt: '2020-04-20T12:08:48.946Z',
    status: {
      inhibitedBy: [],
      silencedBy: [],
      state: 'active',
    },
    updatedAt: '2020-04-20T14:34:03.575Z',
    labels: {
      stt_check: '1',
      agent_id: 'pmm-server',
      agent_type: 'pmm-agent',
      alertname: 'pmm_agent_outdated',
      node_id: 'pmm-server',
      node_name: 'pmm-server',
      service_name: 'pmm-server-postgresql',
      node_type: 'generic',
      severity: 'warning',
    },
  },
  {
    annotations: {
      description: 'MongoDB admin password does not meet the complexity requirement',
      summary: 'MongoDB password is weak',
      read_more_url: '',
    },
    endsAt: '2020-04-20T14:39:03.575Z',
    fingerprint: '0d2242091d134c09',
    receivers: [
      {
        name: 'empty',
      },
    ],
    startsAt: '2020-04-20T12:08:48.946Z',
    status: {
      inhibitedBy: [],
      silencedBy: [],
      state: 'active',
    },
    updatedAt: '2020-04-20T14:34:03.575Z',
    labels: {
      stt_check: '1',
      agent_id: 'pmm-server',
      agent_type: 'pmm-agent',
      alertname: 'pmm_agent_outdated',
      node_id: 'pmm-server',
      node_name: 'pmm-server',
      service_name: 'mongodb-inst-rpl-1',
      node_type: 'generic',
      severity: 'warning',
    },
  },
  {
    annotations: {
      description: 'MongoDB admin password does not meet the complexity requirement',
      summary: 'MongoDB password is weak',
      read_more_url: '',
    },
    endsAt: '2020-04-20T14:39:03.575Z',
    fingerprint: '0d2242091d134c09',
    receivers: [
      {
        name: 'empty',
      },
    ],
    startsAt: '2020-04-20T12:08:48.946Z',
    status: {
      inhibitedBy: [],
      silencedBy: [],
      state: 'suppressed',
    },
    updatedAt: '2020-04-20T14:34:03.575Z',
    labels: {
      stt_check: '1',
      agent_id: 'pmm-server',
      agent_type: 'pmm-agent',
      alertname: 'pmm_agent_outdated',
      node_id: 'pmm-server',
      node_name: 'pmm-server',
      service_name: 'mongodb-inst-rpl-2',
      node_type: 'generic',
      severity: 'warning',
    },
  },
];
