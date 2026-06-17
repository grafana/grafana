import type { RowItem } from 'app/features/dashboard-scene/scene/layout-rows/RowItem';
import type { TabItem } from 'app/features/dashboard-scene/scene/layout-tabs/TabItem';
import { interpolateSectionTitle } from 'app/features/dashboard-scene/utils/interpolateSectionTitle';

export const getSlug = (item: TabItem | RowItem) =>
  interpolateSectionTitle(item, item.state.title || '').replace(/ +/g, '-');
