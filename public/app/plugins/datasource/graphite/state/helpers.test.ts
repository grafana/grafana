import { handleTargetChanged } from './helpers';
import { GraphiteQueryEditorState } from './store';

describe('handleTargetChanged', () => {
  let state: GraphiteQueryEditorState;

  beforeEach(() => {
    state = {
      queryModel: {
        error: null,
        target: { target: 'oldTarget' },
        updateModelTarget: jest.fn(),
      },
      queries: [],
      paused: false,
      refresh: jest.fn(),
    } as unknown as GraphiteQueryEditorState;
  });

  it('should return early if queryModel.error is set', () => {
    state.queryModel.error = new Error('Some error');
    handleTargetChanged(state);
    expect(state.queryModel.updateModelTarget).not.toHaveBeenCalled();
  });

  it('should refresh if target changes and state is not paused', () => {
    state.queryModel.target.target = 'oldTarget';
    (state.queryModel.updateModelTarget as jest.Mock).mockImplementation(() => {
      state.queryModel.target.target = 'newTarget';
    });
    handleTargetChanged(state);
    expect(state.refresh).toHaveBeenCalled();
  });

  it('should refresh if fullTarget changes and state is not paused', () => {
    state.queryModel.target.targetFull = 'oldTargetFull';
    (state.queryModel.updateModelTarget as jest.Mock).mockImplementation(() => {
      state.queryModel.target.targetFull = 'newTargetFull';
    });
    handleTargetChanged(state);
    expect(state.refresh).toHaveBeenCalled();
  });

  it('should not refresh if target does not change', () => {
    handleTargetChanged(state);
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it('should not refresh if state is paused', () => {
    state.paused = true;
    handleTargetChanged(state);
    expect(state.refresh).not.toHaveBeenCalled();
  });
});
