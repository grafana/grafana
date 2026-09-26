import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type LogRecord } from '../../components/rules/state-history/common';

import { InstanceStateTransitions } from './InstanceDetailsDrawer';

const record: LogRecord = {
  timestamp: 1681739580000,
  line: {
    previous: 'Normal',
    current: 'Alerting',
    evalMatches: [{ refId: 'B0', metric: 'http_requests_total', labels: { pod: 'pod-1' }, value: 42 }],
  },
};

test('places evaluation matches across all state transition columns', () => {
  render(<InstanceStateTransitions records={[record]} />);

  const match = screen.getByText('B0: http_requests_total');
  expect(match).toBeInTheDocument();
  expect(screen.getByTestId('state-transition-evaluation-matches')).toContainElement(match);
});
