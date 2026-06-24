import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SceneQueryRunner } from '@grafana/scenes';
import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { mockDataQuery, mockReduceExpression, mockThresholdExpression } from '../../mocks';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType } from '../../types/rule-form';
import { formValuesToRulerGrafanaRuleDTO } from '../../utils/rule-form';
import { WorkbenchProvider } from '../WorkbenchContext';

import { ExplainDrawer } from './ExplainDrawer';

jest.mock('../WorkbenchContext', () => {
  const actual = jest.requireActual('../WorkbenchContext');
  return {
    ...actual,
    useWorkbenchContext: () => ({
      leftColumnWidth: 400,
      rightColumnWidth: 800,
      domain: 'alerting',
      queryRunner: new SceneQueryRunner({}),
      expandGeneration: 0,
      collapseGeneration: 0,
    }),
  };
});

function buildRuleDto() {
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
  });
}

function renderExplainDrawer() {
  return render(
    <WorkbenchProvider
      leftColumnWidth={400}
      rightColumnWidth={800}
      domain="alerting"
      queryRunner={new SceneQueryRunner({})}
      expandGeneration={0}
      collapseGeneration={0}
    >
      <ExplainDrawer rule={buildRuleDto()} onClose={jest.fn()} />
    </WorkbenchProvider>
  );
}

describe('ExplainDrawer', () => {
  it('shows a generated description and AI assistant link', async () => {
    renderExplainDrawer();

    expect(await screen.findByRole('dialog', { name: /explain: api availability/i })).toBeInTheDocument();
    expect(screen.getByText(/alert rule "api availability" monitors query a/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explain further with ai assistant/i })).toBeInTheDocument();
  });
});
