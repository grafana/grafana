import { render, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import { type CombinedRule } from 'app/types/unified-alerting';

import RuleViewer from './RuleViewer';
import { useCombinedRule } from './hooks/useCombinedRule';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('./hooks/useCombinedRule');

// The loaded-event effect lives in the outer RuleViewer; the inner detail view is irrelevant here.
jest.mock('./components/rule-viewer/RuleViewer', () => ({
  __esModule: true,
  default: () => <div>rule detail view</div>,
  useActiveTab: () => ['query'],
}));

// Short-circuit getRuleIdFromPathname (reads locationService) so the identifier parses without a real route.
jest.mock('./utils/rule-id', () => ({
  ...jest.requireActual('./utils/rule-id'),
  getRuleIdFromPathname: () => 'test-rule-uid',
}));

const mockReportInteraction = jest.mocked(reportInteraction);
const mockUseCombinedRule = jest.mocked(useCombinedRule);

describe('RuleViewer loaded CUJ signal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    { status: 'success', hookResult: { loading: false, result: {} as CombinedRule } },
    { status: 'error', hookResult: { loading: false, error: new Error('boom') } },
    { status: 'not_found', hookResult: { loading: false } },
  ])('emits a silent $status event exactly once when the rule settles', async ({ status, hookResult }) => {
    mockUseCombinedRule.mockReturnValue(hookResult);

    render(<RuleViewer />);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_rule_viewer_loaded',
        { status },
        { silent: true }
      )
    );
    expect(mockReportInteraction).toHaveBeenCalledTimes(1);
  });

  it('does not emit while the rule is still loading', async () => {
    mockUseCombinedRule.mockReturnValue({ loading: true });

    render(<RuleViewer />);

    await waitFor(() => expect(mockUseCombinedRule).toHaveBeenCalled());
    expect(mockReportInteraction).not.toHaveBeenCalledWith(
      'grafana_alerting_rule_viewer_loaded',
      expect.anything(),
      expect.anything()
    );
  });
});
