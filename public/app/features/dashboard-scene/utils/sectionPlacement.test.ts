import { SceneObjectBase } from '@grafana/scenes';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

import { getTopPlacementLabel } from './sectionPlacement';

class GenericSectionOwner extends SceneObjectBase<Record<string, never>> {}

describe('getTopPlacementLabel', () => {
  it('returns top of row for rows', () => {
    expect(getTopPlacementLabel(new RowItem())).toBe('Top of row');
  });

  it('returns top of tab for tabs', () => {
    expect(getTopPlacementLabel(new TabItem())).toBe('Top of tab');
  });

  it('returns top of section for generic section owners', () => {
    expect(getTopPlacementLabel(new GenericSectionOwner({}))).toBe('Top of section');
  });
});
