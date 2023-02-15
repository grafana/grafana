import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import {
  mockCombinedRule,
  mockDataSource,
  mockPromAlertingRule,
  mockRulerAlertingRule,
  mockRulerRecordingRule,
  mockRulerRuleGroup,
  mockStore,
  someRulerRules,
} from '../../mocks';
import { GRAFANA_DATASOURCE_NAME } from '../../utils/datasource';

import { CombinedGroupAndNameSpace, EditCloudGroupModal, ModalProps } from './EditRuleGroupModal';

const dsSettings = mockDataSource({
  name: 'Prometheus-1',
  uid: 'Prometheus-1',
});

export const someCloudRulerRules: RulerRulesConfigDTO = {
  namespace1: [
    mockRulerRuleGroup({
      name: 'group1',
      rules: [
        mockRulerRecordingRule({
          record: 'instance:node_num_cpu:sum',
          expr: 'count without (cpu) (count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"}))',
          labels: { type: 'cpu' },
        }),
        mockRulerAlertingRule({ alert: 'nonRecordingRule' }),
      ],
    }),
  ],
};

export const onlyRecordingRulerRules: RulerRulesConfigDTO = {
  namespace1: [
    mockRulerRuleGroup({
      name: 'group1',
      rules: [
        mockRulerRecordingRule({
          record: 'instance:node_num_cpu:sum',
          expr: 'count without (cpu) (count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"}))',
          labels: { type: 'cpu' },
        }),
      ],
    }),
  ],
};

const grafanaNamespace: CombinedRuleNamespace = {
  name: 'namespace1',
  rulesSource: dsSettings,
  groups: [
    {
      name: 'group1',
      rules: [
        mockCombinedRule({
          namespace: {
            groups: [],
            name: 'namespace1',
            rulesSource: mockDataSource(),
          },
          promRule: mockPromAlertingRule(),
          rulerRule: mockRulerAlertingRule(),
        }),
      ],
    },
  ],
};

const group1: CombinedRuleGroup = {
  name: 'group1',
  rules: [
    mockCombinedRule({
      namespace: {
        groups: [],
        name: 'namespace1',
        rulesSource: mockDataSource({ name: 'Prometheus-1' }),
      },
      promRule: mockPromAlertingRule({ name: 'nonRecordingRule' }),
      rulerRule: mockRulerAlertingRule({ alert: 'recordingRule' }),
    }),
  ],
};

const nameSpaceAndGroup: CombinedGroupAndNameSpace = {
  namespace: grafanaNamespace,
  group: group1,
};
const defaultProps: ModalProps = {
  nameSpaceAndGroup: nameSpaceAndGroup,
  sourceName: 'Prometheus-1',
  groupInterval: '1m',
  onClose: jest.fn(),
};

jest.mock('app/types', () => ({
  ...jest.requireActual('app/types'),
  useDispatch: () => jest.fn(),
}));

function getProvidersWrapper(cloudRules?: RulerRulesConfigDTO) {
  return function Wrapper({ children }: React.PropsWithChildren<{}>) {
    const store = mockStore((store) => {
      store.unifiedAlerting.rulerRules[GRAFANA_DATASOURCE_NAME] = {
        loading: false,
        dispatched: true,
        result: someRulerRules,
      };
      store.unifiedAlerting.rulerRules['Prometheus-1'] = {
        loading: false,
        dispatched: true,
        result: cloudRules ?? someCloudRulerRules,
      };
    });

    return <Provider store={store}>{children}</Provider>;
  };
}

describe('EditGroupModal component on cloud alert rules', () => {
  it('Should show alert table in case of having some non-recording rules in the group', () => {
    render(<EditCloudGroupModal {...defaultProps} />, {
      wrapper: getProvidersWrapper(),
    });
    expect(screen.getByText(/nonRecordingRule/i)).toBeInTheDocument();
  });
  it('Should not show alert table in case of not having some non-recording rules in the group', () => {
    render(<EditCloudGroupModal {...defaultProps} />, {
      wrapper: getProvidersWrapper(onlyRecordingRulerRules),
    });
    expect(screen.queryByText(/nonRecordingRule/i)).not.toBeInTheDocument();
    expect(screen.getByText(/this group does not contain alert rules\./i));
  });
});
describe('EditGroupModal component on grafana-managed alert rules', () => {
  it('Should show alert table', () => {
    render(<EditCloudGroupModal {...defaultProps} sourceName={GRAFANA_DATASOURCE_NAME} />, {
      wrapper: getProvidersWrapper(),
    });
    expect(screen.getByText(/alert1/i)).toBeInTheDocument();
  });
});
