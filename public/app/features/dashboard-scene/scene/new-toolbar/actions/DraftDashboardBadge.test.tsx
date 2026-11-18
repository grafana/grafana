import { act, render, screen } from '@testing-library/react';

import { LabelKeyLifecycle, LifecycleDraft } from 'app/features/apiserver/types';

import { registerDraftDashboardExtension } from '../../../saving/enterprise-components/DraftDashboardExtension';
import { DashboardScene } from '../../DashboardScene';

import { DraftDashboardBadge } from './DraftDashboardBadge';

function buildDashboard(labels: Record<string, string>) {
  return new DashboardScene({ uid: 'dash-1', title: 'hello', meta: { k8s: { labels } } });
}

describe('DraftDashboardBadge', () => {
  beforeEach(() => {
    registerDraftDashboardExtension({
      isEnabled: () => true,
      getCreateLabels: async () => ({}),
      DraftBadge: ({ dashboard }) => <span>Draft: {dashboard.state.uid}</span>,
      PublishButton: () => null,
    });
  });

  afterEach(() => {
    registerDraftDashboardExtension(null);
  });

  it('renders the extension badge for a draft', () => {
    render(<DraftDashboardBadge dashboard={buildDashboard({ [LabelKeyLifecycle]: LifecycleDraft })} />);

    expect(screen.getByText('Draft: dash-1')).toBeInTheDocument();
  });

  it('removes the badge once the dashboard is published without a reload', () => {
    const dashboard = buildDashboard({ [LabelKeyLifecycle]: LifecycleDraft });
    render(<DraftDashboardBadge dashboard={dashboard} />);
    expect(screen.getByText('Draft: dash-1')).toBeInTheDocument();

    act(() => dashboard.setK8sLabels({}));

    expect(screen.queryByText('Draft: dash-1')).not.toBeInTheDocument();
  });
});
