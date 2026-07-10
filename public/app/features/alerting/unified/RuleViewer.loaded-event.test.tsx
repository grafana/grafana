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

// getRuleIdFromPathname reads locationService; short-circuit to a valid Grafana UID so the
// identifier parses without a real route.
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

  it('emits a silent success event exactly once when the rule loads', async () => {
    mockUseCombinedRule.mockReturnValue({ loading: false, result: {} as CombinedRule });

    render(<RuleViewer />);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_rule_viewer_loaded',
        { status: 'success' },
        { silent: true }
      )
    );
    expect(mockReportInteraction).toHaveBeenCalledTimes(1);
  });

  it('emits an error event when the rule fetch fails', async () => {
    mockUseCombinedRule.mockReturnValue({ loading: false, error: new Error('boom') });

    render(<RuleViewer />);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_rule_viewer_loaded',
        { status: 'error' },
        { silent: true }
      )
    );
  });

  it('emits a not_found event when the rule is missing', async () => {
    mockUseCombinedRule.mockReturnValue({ loading: false });

    render(<RuleViewer />);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_rule_viewer_loaded',
        { status: 'not_found' },
        { silent: true }
      )
    );
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
