import { InMemoryProvider, OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { reportExperimentView, reportInteraction } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';

import { trackSignalExplorerExperimentQueriesRun, useSignalExplorerFlag } from './experiment';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportExperimentView: jest.fn(),
  reportInteraction: jest.fn(),
}));

const domain = 'signal-explorer-experiment-tests';
let provider: InMemoryProvider;
// The module dedupes per pane for the whole page load, so every test takes panes no other test used.
let paneCounter = 0;
const nextPane = () => `pane-${++paneCounter}`;

function configureVariant(variant: string, value: boolean) {
  provider.putConfiguration({
    [FlagKeys.GrafanaExploreMetricsSidebar]: {
      variants: { [variant]: value },
      defaultVariant: variant,
      disabled: false,
    },
  });
}

function wrapper({ children }: PropsWithChildren) {
  return <OpenFeatureProvider client={OpenFeature.getClient(domain)}>{children}</OpenFeatureProvider>;
}

function renderFlag(exploreId: string, eligible = true) {
  return renderHook(({ id, isEligible }) => useSignalExplorerFlag(id, isEligible), {
    wrapper,
    initialProps: { id: exploreId, isEligible: eligible },
  });
}

beforeEach(async () => {
  provider = new InMemoryProvider();
  await OpenFeature.setProviderAndWait(domain, provider);
  jest.mocked(reportExperimentView).mockClear();
  jest.mocked(reportInteraction).mockClear();
});

describe('useSignalExplorerFlag', () => {
  it.each([
    { variant: 'enabled', value: true, arm: 'treatment' },
    { variant: 'disabled', value: false, arm: 'control' },
  ])('exposes the $variant variant as $arm', ({ variant, value, arm }) => {
    configureVariant(variant, value);
    const { result } = renderFlag(nextPane());

    expect(result.current).toBe(value);
    expect(reportExperimentView).toHaveBeenCalledTimes(1);
    expect(reportExperimentView).toHaveBeenCalledWith('signal_explorer', 'explore_prometheus', arm);
  });

  it.each([
    { desc: 'the excluded variant', variant: 'excluded', value: false },
    { desc: 'an unrecognised variant', variant: 'testedVariant', value: false },
    { desc: 'an enabled variant carrying false', variant: 'enabled', value: false },
  ])('keeps the sidebar off and exposes nobody for $desc', ({ variant, value }) => {
    configureVariant(variant, value);
    const { result } = renderFlag(nextPane());

    expect(result.current).toBe(false);
    expect(reportExperimentView).not.toHaveBeenCalled();
  });

  it('exposes a pane only once it becomes eligible', () => {
    configureVariant('disabled', false);
    const { rerender } = renderFlag('pane-eligibility', false);
    expect(reportExperimentView).not.toHaveBeenCalled();

    rerender({ id: 'pane-eligibility', isEligible: true });
    expect(reportExperimentView).toHaveBeenCalledWith('signal_explorer', 'explore_prometheus', 'control');
  });

  it('exposes a pane once across remounts, and a new pane again', () => {
    configureVariant('enabled', true);
    const pane = nextPane();
    renderFlag(pane).unmount();
    renderFlag(pane);
    expect(reportExperimentView).toHaveBeenCalledTimes(1);

    renderFlag(nextPane());
    expect(reportExperimentView).toHaveBeenCalledTimes(2);
  });

  it('does not read a missing flag as control, and exposes once it resolves', async () => {
    renderFlag(nextPane());
    expect(reportExperimentView).not.toHaveBeenCalled();

    await act(async () => configureVariant('disabled', false));
    expect(reportExperimentView).toHaveBeenCalledTimes(1);
    expect(reportExperimentView).toHaveBeenCalledWith('signal_explorer', 'explore_prometheus', 'control');
  });
});

describe('trackSignalExplorerExperimentQueriesRun', () => {
  it('stamps the arm on queries run from an exposed pane', () => {
    configureVariant('disabled', false);
    const pane = nextPane();
    renderFlag(pane);

    trackSignalExplorerExperimentQueriesRun(pane, { data_source_type: 'prometheus', queries_count: 2 });

    expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_queries_run', {
      data_source_type: 'prometheus',
      queries_count: 2,
      experiment_signal_explorer: 'control',
    });
  });

  it('sends nothing for a pane that was never exposed', () => {
    configureVariant('enabled', true);
    renderFlag(nextPane());

    trackSignalExplorerExperimentQueriesRun(nextPane(), { data_source_type: 'prometheus', queries_count: 1 });

    expect(reportExperimentView).toHaveBeenCalledTimes(1);
    expect(reportInteraction).not.toHaveBeenCalled();
  });
});
