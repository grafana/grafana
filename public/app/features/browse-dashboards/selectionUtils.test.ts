import { hasUID, wellFormedTree } from './fixtures/dashboardsTreeItem.fixture';
import { itemIsSelected } from './selectionUtils';

describe('browse-dashboards selectionUtils', () => {
  describe('itemIsSelected', () => {
    const [
      tree,
      { folderA, folderA_folderC, folderA_folderC_dashbdA, folderA_folderC_dashbdB, folderB, folderC, folderB_empty },
    ] = wellFormedTree();

    it('is checked when item is selected', () => {
      const selected = {
        folder: { [hasUID(folderC.item).uid]: true },
        dashboard: {},
        panel: {},
      };

      const isSelected = itemIsSelected(tree, selected, folderC);
      expect(isSelected).toBe('selected');
    });

    it("is checked when item's parent is selected", () => {
      const selected = {
        folder: { [hasUID(folderA_folderC.item).uid]: true },
        dashboard: {},
        panel: {},
      };

      const isSelected = itemIsSelected(tree, selected, folderA_folderC_dashbdA);
      expect(isSelected).toBe('selected');
    });

    it("is checked when item's grandparent parent is selected", () => {
      const selected = {
        folder: { [hasUID(folderA.item).uid]: true },
        dashboard: {},
        panel: {},
      };

      const isSelected = itemIsSelected(tree, selected, folderA_folderC_dashbdA);
      expect(isSelected).toBe('selected');
    });

    it("is unchecked when item's sibling is selected", () => {
      const selected = {
        folder: { [hasUID(folderA_folderC_dashbdA.item).uid]: true },
        dashboard: {},
        panel: {},
      };

      const isSelected = itemIsSelected(tree, selected, folderA_folderC_dashbdB);
      expect(isSelected).toBe('unselected');
    });

    it('is unchecked for special ui rows', () => {
      const selected = {
        folder: { [hasUID(folderB.item).uid]: true },
        dashboard: {},
        panel: {},
      };

      const isSelected = itemIsSelected(tree, selected, folderB_empty);
      expect(isSelected).toBe('unselected');
    });

    it.todo('is checked when all children are selected');
    it.todo('is indeterminate when some children are selected');
    it.todo('is indeterminate when some grand children are selected');
  });
});
