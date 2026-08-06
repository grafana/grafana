import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { DashboardEditActionsHistory } from './DashboardEditActionsHistory';
import { edit } from './utils/edit';

interface RootState extends SceneObjectState {
  history?: DashboardEditActionsHistory;
}

class RootSceneObject extends SceneObjectBase<RootState> {
  public constructor() {
    super({});
  }
}

describe('DashboardEditActionsHistory', () => {
  it('records actions published on the root and undoes them in reverse order', () => {
    const root = new RootSceneObject();
    const history = new DashboardEditActionsHistory();
    root.setState({ history });

    const deactivateRoot = root.activate();
    const deactivateHistory = history.activate();

    const first = { perform: jest.fn(), undo: jest.fn() };
    const second = { perform: jest.fn(), undo: jest.fn() };

    edit({
      source: root,
      description: 'first',
      perform: first.perform,
      undo: first.undo,
    });
    edit({
      source: root,
      description: 'second',
      perform: second.perform,
      undo: second.undo,
    });

    expect(first.perform).toHaveBeenCalledTimes(1);
    expect(second.perform).toHaveBeenCalledTimes(1);
    expect(history.state.undoStack).toHaveLength(2);
    expect(history.state.redoStack).toHaveLength(0);

    history.undoAction();

    expect(second.undo).toHaveBeenCalledTimes(1);
    expect(first.undo).not.toHaveBeenCalled();
    expect(history.state.undoStack).toHaveLength(1);
    expect(history.state.redoStack).toHaveLength(1);

    history.undoAction();

    expect(first.undo).toHaveBeenCalledTimes(1);
    expect(history.state.undoStack).toHaveLength(0);
    expect(history.state.redoStack).toHaveLength(2);

    history.redoAction();

    expect(first.perform).toHaveBeenCalledTimes(2);
    expect(history.state.undoStack).toHaveLength(1);
    expect(history.state.redoStack).toHaveLength(1);

    // A new action clears the redo stack
    edit({
      source: root,
      description: 'third',
      perform: jest.fn(),
      undo: jest.fn(),
    });

    expect(history.state.redoStack).toHaveLength(0);
    expect(history.state.undoStack).toHaveLength(2);

    deactivateHistory();
    deactivateRoot();
  });

  it('notifies the host about added and removed objects', () => {
    const root = new RootSceneObject();
    const history = new DashboardEditActionsHistory();
    root.setState({ history });

    const added = new RootSceneObject();
    const host = {
      onObjectAdded: jest.fn(),
      clearSelection: jest.fn(),
      selectObject: jest.fn(),
      getSelectedObject: jest.fn(),
      fixSelectionOfRemovedObject: jest.fn(),
    };
    history.setHost(host);

    const deactivateRoot = root.activate();
    const deactivateHistory = history.activate();

    edit({
      source: root,
      description: 'add',
      addedObject: added,
      perform: jest.fn(),
      undo: jest.fn(),
    });

    expect(host.onObjectAdded).toHaveBeenCalledWith(added);

    history.undoAction();

    expect(host.clearSelection).toHaveBeenCalled();

    deactivateHistory();
    deactivateRoot();
  });
});
