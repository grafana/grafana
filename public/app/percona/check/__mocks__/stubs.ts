import { CheckDetails } from '../types';

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

export const allChecksStub: CheckDetails[] = [
  {
    name: 'test1',
    summary: 'Test 1',
    description: 'Test number 1',
    interval: 'ADVISOR_CHECK_INTERVAL_STANDARD',
    readMoreUrl: 'https://example.com',
    category: '',
    family: 'ADVISOR_CHECK_FAMILY_MONGODB',
  },
  {
    name: 'test2',
    summary: 'Test 2',
    description: 'Test number 2',
    interval: 'ADVISOR_CHECK_INTERVAL_RARE',
    category: '',
    family: 'ADVISOR_CHECK_FAMILY_MONGODB',
  },
  {
    name: 'test3',
    summary: 'Test 3',
    description: 'Test number 3',
    interval: 'ADVISOR_CHECK_INTERVAL_STANDARD',
    disabled: true,
    readMoreUrl: 'https://example.com',
    category: '',
    family: 'ADVISOR_CHECK_FAMILY_MONGODB',
  },
  {
    name: 'test4',
    summary: 'Test 4',
    interval: 'ADVISOR_CHECK_INTERVAL_FREQUENT',
    category: '',
    family: 'ADVISOR_CHECK_FAMILY_MONGODB',
  },
  {
    name: 'test5',
    summary: 'Test 5',
    disabled: true,
    interval: 'ADVISOR_CHECK_INTERVAL_STANDARD',
    category: '',
    family: 'ADVISOR_CHECK_FAMILY_MONGODB',
  },
];
