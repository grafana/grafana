import { type ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';

import { type DragNode, type DropNode } from '../../types';

import { getTreeData, onNodeDrop, type TreeElement } from './tree';

const createMockFrameState = (elements: unknown[]): FrameState => {
  return { elements } as FrameState;
};

const createMockDropNode = (key: number, pos: string): DropNode => {
  return { key, pos, dataRef: {} as ElementState } as DropNode;
};

const createMockDragNode = (key: number): DragNode => {
  return { key, dataRef: {} as ElementState } as DragNode;
};

describe('tree', () => {
  describe('getTreeData', () => {
    it('should return empty array when root is undefined', () => {
      const result = getTreeData(undefined);

      expect(result).toEqual([]);
    });

    it('should return empty array when root has no elements', () => {
      const root = createMockFrameState([]);

      const result = getTreeData(root);

      expect(result).toEqual([]);
    });

    it('should transform single element into tree structure', () => {
      const element = {
        UID: 1,
        getName: () => 'Element 1',
      };
      const root = createMockFrameState([element]);

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
      const root = createMockFrameState([elem1, elem2]);

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

      const root = createMockFrameState([frameElement]);

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

      const root = createMockFrameState([topFrame]);

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
      dataRef: {} as ElementState,
      children,
    });

    it('should drop element on content (destPosition 0)', () => {
      const treeData: TreeElement[] = [
        createTreeElement(1, 'Parent', [createTreeElement(2, 'Child')]),
        createTreeElement(3, 'Dragged'),
      ];

      const info = {
        node: createMockDropNode(1, '0-0'),
        dragNode: createMockDragNode(2),
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
        node: createMockDropNode(1, '0-0'),
        dragNode: createMockDragNode(2),
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
