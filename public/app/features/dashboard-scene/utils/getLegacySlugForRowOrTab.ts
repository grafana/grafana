import kbn from 'app/core/utils/kbn';
import type { RowItem } from 'app/features/dashboard-scene/scene/layout-rows/RowItem';
import type { TabItem } from 'app/features/dashboard-scene/scene/layout-tabs/TabItem';
import { interpolateSectionTitle } from 'app/features/dashboard-scene/utils/interpolateSectionTitle';

export function getLegacySlugForRowOrTab(tab: TabItem | RowItem): string {
  return kbn.slugifyForUrl(interpolateSectionTitle(tab, tab.state.title || ''));
}
