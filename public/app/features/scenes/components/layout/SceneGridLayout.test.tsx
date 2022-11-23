import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from '../../../../store/configureStore';
import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChildState } from '../../core/types';
import { Scene } from '../Scene';

import { SceneGridLayout, SceneGridRow } from './SceneGridLayout';

// Mocking AutoSizer to allow testing of the SceneGridLayout component rendering
jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: (args: { width: number; height: number }) => React.ReactNode }) =>
      children({ height: 600, width: 600 })
);

class TestObject extends SceneObjectBase<SceneLayoutChildState> {
  public static Component = (m: SceneComponentProps<TestObject>) => {
    return <div data-testid="test-object">TestObject</div>;
  };
}

function renderWithProvider(element: JSX.Element) {
  const store = configureStore();
  return render(<Provider store={store}>{element}</Provider>);
}

describe('SceneGridLayout', () => {
  describe('rendering', () => {
    it('should render all grid children', async () => {
      const scene = new Scene({
        title: 'Grid test',
        layout: new SceneGridLayout({
          children: [
            new TestObject({ size: { x: 0, y: 0, width: 12, height: 5 } }),
            new TestObject({ size: { x: 0, y: 5, width: 12, height: 5 } }),
          ],
        }),
      });

      renderWithProvider(<scene.Component model={scene} />);

      expect(screen.queryAllByTestId('test-object')).toHaveLength(2);
    });

    it('should not render children of a collapsed row', async () => {
      const scene = new Scene({
        title: 'Grid test',
        layout: new SceneGridLayout({
          children: [
            new TestObject({ key: 'a', size: { x: 0, y: 0, width: 12, height: 5 } }),
            new TestObject({ key: 'b', size: { x: 0, y: 5, width: 12, height: 5 } }),
            new SceneGridRow({
              title: 'Row A',
              key: 'Row A',
              isCollapsed: true,
              size: { y: 10 },
              children: [new TestObject({ key: 'c', size: { x: 0, y: 11, width: 12, height: 5 } })],
            }),
          ],
        }),
      });

      renderWithProvider(<scene.Component model={scene} />);

      expect(screen.queryAllByTestId('test-object')).toHaveLength(2);
    });

    it('should  render children of an expanded row', async () => {
      const scene = new Scene({
        title: 'Grid test',
        layout: new SceneGridLayout({
          children: [
            new TestObject({ key: 'a', size: { x: 0, y: 0, width: 12, height: 5 } }),
            new TestObject({ key: 'b', size: { x: 0, y: 5, width: 12, height: 5 } }),
            new SceneGridRow({
              title: 'Row A',
              key: 'Row A',
              isCollapsed: false,
              size: { y: 10 },
              children: [new TestObject({ key: 'c', size: { x: 0, y: 11, width: 12, height: 5 } })],
            }),
          ],
        }),
      });

      renderWithProvider(<scene.Component model={scene} />);

      expect(screen.queryAllByTestId('test-object')).toHaveLength(3);
    });
  });

  describe('when moving a panel', () => {
    it('shoud update layout children placement and order ', () => {
      const layout = new SceneGridLayout({
        children: [
          new TestObject({ key: 'a', size: { x: 0, y: 0, width: 1, height: 1 } }),
          new TestObject({ key: 'b', size: { x: 1, y: 0, width: 1, height: 1 } }),
          new TestObject({ key: 'c', size: { x: 0, y: 1, width: 1, height: 1 } }),
        ],
      });
      layout.onDragStop(
        [
          { i: 'b', x: 0, y: 0, w: 1, h: 1 },
          {
            i: 'a',
            x: 0,
            y: 1,
            w: 1,
            h: 1,
          },
          {
            i: 'c',
            x: 0,
            y: 2,
            w: 1,
            h: 1,
          },
        ],
        // @ts-expect-error
        {},
        { i: 'b', x: 0, y: 0, w: 1, h: 1 },
        {},
        {},
        {}
      );

      expect(layout.state.children[0].state.key).toEqual('b');
      expect(layout.state.children[0].state.size).toEqual({ x: 0, y: 0, width: 1, height: 1 });
      expect(layout.state.children[1].state.key).toEqual('a');
      expect(layout.state.children[1].state.size).toEqual({ x: 0, y: 1, width: 1, height: 1 });
      expect(layout.state.children[2].state.key).toEqual('c');
      expect(layout.state.children[2].state.size).toEqual({ x: 0, y: 2, width: 1, height: 1 });
    });
  });

  describe('when using rows', () => {
    it('should update objects relations when moving object out of a row', () => {
      const rowAChild1 = new TestObject({ key: 'row-a-child1', size: { x: 0, y: 1, width: 1, height: 1 } });
      const rowAChild2 = new TestObject({ key: 'row-a-child2', size: { x: 1, y: 1, width: 1, height: 1 } });

      const sourceRow = new SceneGridRow({
        title: 'Row A',
        key: 'row-a',
        children: [rowAChild1, rowAChild2],
        size: { y: 0 },
      });

      const layout = new SceneGridLayout({
        children: [sourceRow],
      });

      const updatedLayout = layout.moveChildTo(rowAChild1, layout);

      expect(updatedLayout.length).toEqual(2);

      // the source row should be cloned and with children updated
      expect(updatedLayout[0].state.key).toEqual(sourceRow.state.key);
      expect(updatedLayout[0]).not.toEqual(sourceRow);
      expect((updatedLayout[0] as SceneGridRow).state.children.length).toEqual(1);
      expect((updatedLayout[0] as SceneGridRow).state.children).not.toContain(rowAChild1);

      // the moved child should be cloned in the root
      expect(updatedLayout[1].state.key).toEqual(rowAChild1.state.key);
      expect(updatedLayout[1]).not.toEqual(rowAChild1);
    });
    it('should update objects relations when moving objects between rows', () => {
      const rowAChild1 = new TestObject({ key: 'row-a-child1', size: { x: 0, y: 0, width: 1, height: 1 } });
      const rowAChild2 = new TestObject({ key: 'row-a-child2', size: { x: 1, y: 0, width: 1, height: 1 } });

      const sourceRow = new SceneGridRow({
        title: 'Row A',
        key: 'row-a',
        children: [rowAChild1, rowAChild2],
      });

      const targetRow = new SceneGridRow({
        title: 'Row B',
        key: 'row-b',
        children: [],
      });

      const panelOutsideARow = new TestObject({ key: 'a', size: { x: 0, y: 0, width: 1, height: 1 } });
      const layout = new SceneGridLayout({
        children: [panelOutsideARow, sourceRow, targetRow],
      });

      const updatedLayout = layout.moveChildTo(rowAChild1, targetRow);

      expect(updatedLayout[0]).toEqual(panelOutsideARow);

      // the source row should be cloned and with children updated
      expect(updatedLayout[1].state.key).toEqual(sourceRow.state.key);
      expect(updatedLayout[1]).not.toEqual(sourceRow);
      expect((updatedLayout[1] as SceneGridRow).state.children.length).toEqual(1);

      // the target row should be cloned and with children updated
      expect(updatedLayout[2].state.key).toEqual(targetRow.state.key);
      expect(updatedLayout[2]).not.toEqual(targetRow);
      expect((updatedLayout[2] as SceneGridRow).state.children.length).toEqual(1);

      // the moved object should be cloned and added to the target row
      const movedObject = (updatedLayout[2] as SceneGridRow).state.children[0];
      expect(movedObject.state.key).toEqual('row-a-child1');
      expect(movedObject).not.toEqual(rowAChild1);
    });

    it('should update position of objects when row is expanded', () => {
      const rowAChild1 = new TestObject({ key: 'row-a-child1', size: { x: 0, y: 1, width: 1, height: 1 } });
      const rowAChild2 = new TestObject({ key: 'row-a-child2', size: { x: 1, y: 1, width: 1, height: 1 } });

      const rowA = new SceneGridRow({
        title: 'Row A',
        key: 'row-a',
        children: [rowAChild1, rowAChild2],
        size: { y: 0 },
        isCollapsed: true,
      });

      const panelOutsideARow = new TestObject({ key: 'outsider', size: { x: 0, y: 1, width: 1, height: 1 } });

      const rowBChild1 = new TestObject({ key: 'row-b-child1', size: { x: 0, y: 3, width: 1, height: 1 } });
      const rowB = new SceneGridRow({
        title: 'Row B',
        key: 'row-b',
        children: [rowBChild1],
        size: { y: 2 },
        isCollapsed: false,
      });

      const layout = new SceneGridLayout({
        children: [rowA, panelOutsideARow, rowB],
      });

      layout.toggleRow(rowA);

      expect(panelOutsideARow.state!.size!.y).toEqual(2);
      expect(rowB.state!.size!.y).toEqual(3);
      expect(rowBChild1.state!.size!.y).toEqual(4);
    });
  });
});
