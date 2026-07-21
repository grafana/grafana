import { z } from 'zod';

import { isIconName } from '@grafana/data';

const HomepageTabSchema = z.object({
  id: z.string(),
  label: z.string(),
  activeLabel: z.string().optional(),
  icon: z.string().refine(isIconName, { error: 'Unknown icon' }).optional(),
  /** Tab is a link (rendered right-aligned) */
  href: z.string().optional(),
  /** Item count shown as badge on the tab */
  counter: z.number().optional(),
});

export type HomepageTab = z.infer<typeof HomepageTabSchema>;

export function validateHomepageTab(value: unknown): asserts value is HomepageTab {
  const result = HomepageTabSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid tab object returned from extension: ${z.prettifyError(result.error)}`);
  }
}

export interface HomepageTabExtensionProps {
  active: boolean;
  register: (tab: HomepageTab) => () => void;
}

// Fixed scroll-area heights for the tab content. Shared with DashboardTabs so the
// skeleton matches the real card and loading doesn't shift neighboring content.
export const DASHBOARD_TABS_SCROLL_HEIGHT_DEFAULT = 256;
export const DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN = 350;
