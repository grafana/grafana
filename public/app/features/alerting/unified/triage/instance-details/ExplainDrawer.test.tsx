import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { render } from 'test/test-utils';

import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { GrafanaAlertState, type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { mockDataQuery, mockReduceExpression, mockThresholdExpression } from '../../mocks';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType } from '../../types/rule-form';
import { formValuesToRulerGrafanaRuleDTO } from '../../utils/rule-form';

import { ExplainDrawer } from './ExplainDrawer';
import { registerExplainAssistantQuestions } from './registerExplainAssistantQuestions';

const mockAssistantContext = [{ node: { title: 'Alert instance: API availability' } }];
const mockRegisterExplainAssistantQuestions = jest.mocked(registerExplainAssistantQuestions);

jest.mock('./explainAssistantContext', () => ({
  createExplainAssistantContext: jest.fn(() => [{ node: { title: 'Alert instance: API availability' } }]),
}));

jest.mock('./registerExplainAssistantQuestions', () => ({
  registerExplainAssistantQuestions: jest.fn(),
}));

jest.mock('@grafana/assistant', () => {
  const actual = jest.requireActual('@grafana/assistant');
  return {
    ...actual,
    useAssistant: jest.fn(() => ({
      isLoading: false,
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    })),
  };
});

jest.mock('../WorkbenchContext', () => {
  const actual = jest.requireActual('../WorkbenchContext');
  return {
    ...actual,
    useWorkbenchContext: () => ({
      leftColumnWidth: 400,
      rightColumnWidth: 800,
      domain: [new Date(), new Date()],
      queryRunner: {},
      expandGeneration: 0,
      collapseGeneration: 0,
    }),
  };
});

function buildRuleDto(): RulerGrafanaRuleDTO {
  const dataQuery = mockDataQuery({ refId: 'A' });
  Object.assign(dataQuery.model, { expr: 'up{job="api"} == 0' });

  const reduceQuery = mockReduceExpression({ refId: 'B', expression: 'A', reducer: 'last' });
  const thresholdQuery = mockThresholdExpression({
    refId: 'C',
    expression: 'B',
    conditions: [
      {
        type: 'query',
        evaluator: { params: [0], type: EvalFunction.IsAbove },
        operator: { type: 'and' },
        query: { params: ['C'] },
        reducer: { params: [], type: 'last' },
      },
    ],
  });

  return formValuesToRulerGrafanaRuleDTO({
    ...getDefaultFormValues(RuleFormType.grafana),
    name: 'API availability',
    type: RuleFormType.grafana,
    condition: 'C',
    queries: [dataQuery, reduceQuery, thresholdQuery],
    evaluateFor: '5m',
    evaluateEvery: '1m',
  }) as RulerGrafanaRuleDTO;
}

function renderExplainDrawer(props: Partial<ComponentProps<typeof ExplainDrawer>> = {}) {
  return render(
    <ExplainDrawer
      rule={buildRuleDto()}
      ruleUID="rule-uid-1"
      instanceLabels={{ job: 'api', instance: 'server-1' }}
      commonLabels={{ team: 'platform' }}
      instanceState={GrafanaAlertState.Alerting}
      onClose={jest.fn()}
      {...props}
    />
  );
}

describe('ExplainDrawer', () => {
  beforeEach(() => {
    const { useAssistant } = jest.requireMock('@grafana/assistant');
    useAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
  });

  it('shows a generated description and AI assistant link', async () => {
    renderExplainDrawer();

    expect(await screen.findByRole('dialog', { name: /explain: api availability/i })).toBeInTheDocument();
    expect(screen.getByText(/alert rule "api availability" monitors query a/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explain with assistant/i })).toBeInTheDocument();
  });

  it('hides the assistant link when assistant is not available', async () => {
    const { useAssistant } = jest.requireMock('@grafana/assistant');
    useAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: undefined,
      toggleAssistant: undefined,
    });

    renderExplainDrawer();

    expect(await screen.findByRole('dialog', { name: /explain: api availability/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /explain with assistant/i })).not.toBeInTheDocument();
  });

  it('opens the assistant sidebar with alert context', async () => {
    const user = userEvent.setup();
    const onDismissDrawers = jest.fn();
    const { useAssistant } = jest.requireMock('@grafana/assistant');
    const openAssistant = jest.fn();
    useAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    renderExplainDrawer({ onDismissDrawers });

    await user.click(await screen.findByRole('link', { name: /explain with assistant/i }));

    expect(onDismissDrawers).toHaveBeenCalled();
    expect(openAssistant).toHaveBeenCalledWith({
      origin: 'alerting/triage/explain-drawer',
      mode: 'assistant',
      autoSend: false,
      context: mockAssistantContext,
    });
  });
});
