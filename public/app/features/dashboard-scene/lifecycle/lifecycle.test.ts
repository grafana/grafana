import { defaultSpec as defaultDashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { getLifecycleBreadcrumbLabel } from './lifecycle';
import { type PendingChangePreview } from './pendingChangePreview';

const preview = (baseGeneration: number, previewing = true): PendingChangePreview => ({
  id: 'chat-1',
  previewing,
  pending: { baseGeneration, proposed: defaultDashboardV2Spec(), apply: jest.fn(), discard: jest.fn() },
});

describe('getLifecycleBreadcrumbLabel', () => {
  it('labels a pending changes preview', () => {
    expect(getLifecycleBreadcrumbLabel(preview(3))).toBe('Pending changes');
  });

  it('labels a new dashboard that is not saved yet as a draft', () => {
    expect(getLifecycleBreadcrumbLabel(preview(0))).toBe('Draft');
  });

  it('shows nothing for the saved dashboard', () => {
    expect(getLifecycleBreadcrumbLabel(preview(3, false))).toBeUndefined();
    expect(getLifecycleBreadcrumbLabel(undefined)).toBeUndefined();
  });
});
