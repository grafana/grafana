import { FrameState } from 'app/features/canvas/runtime/frame';

import { getTreeData, onNodeDrop, type TreeElement } from './tree';

describe('tree', () => {
  describe('getTreeData', () => {
    it('should return empty array when root is undefined', () => {
      const result = getTreeData(undefined);

      expect(result).toEqual([]);
    });

    it('should return empty array when root has no elements', () => {
      const root = {
        elements: [],
      } as Partial<FrameState>;

      const result = getTreeData(root);

      expect(result).toEqual([]);
    });

    it('should transform single element into tree structure', () => {
      const element = {
        UID: 1,
        getName: () => 'Element 1',
      };
      const root = {
        elements: [element],
      } as Partial<FrameState>;

      const result = getTreeData(root);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        key: 1,
        title: 'Element 1',
        selectable: true,
        dataRef: element,
      });
    });

    it('should transform multiple elements', () => {
      const elem1 = { UID: 1, getName: () => 'Element 1' };
      const elem2 = { UID: 2, getName: () => 'Element 2' };
      const root = {
        elements: [elem1, elem2],
      } as Partial<FrameState>;

      const result = getTreeData(root);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe(2);
      expect(result[1].key).toBe(1);
    });

    it('should recursively transform FrameState elements with children', () => {
      const childElement = { UID: 2, getName: () => 'Child Element' };
      const frameElement = {
        UID: 1,
        getName: () => 'Frame',
        elements: [childElement],
      };
      Object.setPrototypeOf(frameElement, FrameState.prototype);

      const root = {
        elements: [frameElement],
      } as Partial<FrameState>;

      const result = getTreeData(root);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe(1);
      expect(result[0].title).toBe('Frame');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0]).toMatchObject({
        key: 2,
        title: 'Child Element',
        selectable: true,
      });
    });

    it('should handle nested FrameState elements', () => {
      const deepChild = { UID: 3, getName: () => 'Deep Child' };
      const nestedFrame = {
        UID: 2,
        getName: () => 'Nested Frame',
        elements: [deepChild],
      };
      Object.setPrototypeOf(nestedFrame, FrameState.prototype);

      const topFrame = {
        UID: 1,
        getName: () => 'Top Frame',
        elements: [nestedFrame],
      };
      Object.setPrototypeOf(topFrame, FrameState.prototype);

      const root = {
        elements: [topFrame],
      } as Partial<FrameState>;

      const result = getTreeData(root);

      expect(result[0].children![0].children).toHaveLength(1);
      expect(result[0].children![0].children![0].key).toBe(3);
    });
  });

  describe('onNodeDrop', () => {
    const createTreeElement = (key: number, title: string, children?: TreeElement[]): TreeElement => ({
      key,
      title,
      selectable: true,
      dataRef: {} as Record<string, unknown>,
      children,
    });

    it('should drop element on content (destPosition 0)', () => {
      const treeData: TreeElement[] = [
        createTreeElement(1, 'Parent', [createTreeElement(2, 'Child')]),
        createTreeElement(3, 'Dragged'),
      ];

      const info = {
        node: { key: 1, pos: '0-0' } as { key: number; pos: string },
        dragNode: { key: 3 } as { key: number },
        dropPosition: 0,
        dropToGap: false,
      };

      const result = onNodeDrop(info, treeData);

      expect(result[0].children).toHaveLength(2);
      expect(result[0].children![0].key).toBe(3);
      expect(result).toHaveLength(1);
    });

    it('should insert before element (destPosition -1)', () => {
      const treeData: TreeElement[] = [
        createTreeElement(1, 'First'),
        createTreeElement(2, 'Second'),
        createTreeElement(3, 'Dragged'),
      ];

      const info = {
        node: { key: 2, pos: '0-1' } as { key: number; pos: string },
        dragNode: { key: 3 } as { key: number },
        dropPosition: 0,
        dropToGap: true,
      };

      const result = onNodeDrop(info, treeData);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe(1);
      expect(result[1].key).toBe(3);
      expect(result[2].key).toBe(2);
    });

    it('should insert after element (destPosition 1)', () => {
      const treeData: TreeElement[] = [
        createTreeElement(1, 'First'),
        createTreeElement(2, 'Second'),
        createTreeElement(3, 'Dragged'),
      ];

      const info = {
        node: { key: 1, pos: '0-0' } as { key: number; pos: string },
        dragNode: { key: 3 } as { key: number },
        dropPosition: 1,
        dropToGap: true,
      };

      const result = onNodeDrop(info, treeData);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe(1);
      expect(result[1].key).toBe(3);
      expect(result[2].key).toBe(2);
    });

    it('should handle drag within nested children', () => {
      const treeData: TreeElement[] = [
        createTreeElement(1, 'Parent', [createTreeElement(2, 'Child1'), createTreeElement(3, 'Child2')]),
      ];

      const info = {
        node: { key: 2, pos: '0-0-0' } as { key: number; pos: string },
        dragNode: { key: 3 } as { key: number },
        dropPosition: -1,
        dropToGap: true,
      };

      const result = onNodeDrop(info, treeData);

      expect(result[0].children).toHaveLength(2);
      expect(result[0].children![0].key).toBe(3);
      expect(result[0].children![1].key).toBe(2);
    });

    it('should create children array if dropping on element without children', () => {
      const treeData: TreeElement[] = [createTreeElement(1, 'Parent'), createTreeElement(2, 'Dragged')];

      const info = {
        node: { key: 1, pos: '0-0' } as { key: number; pos: string },
        dragNode: { key: 2 } as { key: number },
        dropPosition: 0,
        dropToGap: false,
      };

      const result = onNodeDrop(info, treeData);

      expect(result[0].children).toBeDefined();
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].key).toBe(2);
    });

    it('should not mutate original tree data', () => {
      const treeData: TreeElement[] = [createTreeElement(1, 'First'), createTreeElement(2, 'Second')];

      const info = {
        node: { key: 1, pos: '0-0' } as { key: number; pos: string },
        dragNode: { key: 2 } as { key: number },
        dropPosition: 1,
        dropToGap: true,
      };

      onNodeDrop(info, treeData);

      expect(treeData).toHaveLength(2);
      expect(treeData[0].key).toBe(1);
      expect(treeData[1].key).toBe(2);
    });
  });
});
