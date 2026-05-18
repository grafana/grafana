import { type ReactNode } from 'react';

import { type IconName } from '@grafana/data';

export interface HomepageTab {
  id: string;
  label: string;
  activeLabel?: string;
  icon?: IconName;
  /** Tab renders content inline */
  content?: ReactNode;
  /** Tab is a link (rendered right-aligned) */
  href?: string;
  /** Item count shown as badge on the tab */
  counter?: number;
}
