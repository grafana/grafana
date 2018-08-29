import { VariableEditorCtrl } from '../editor_ctrl';

let mockEmit;
jest.mock('app/core/app_events', () => {
  mockEmit = jest.fn();
  return {
    emit: mockEmit,
  };
});

describe('VariableEditorCtrl', () => {
  const scope = {
    runQuery: () => {
      return Promise.resolve({});
    },
  };

  describe('When running a variable query and the data source returns an error', () => {
    beforeEach(() => {
      const variableSrv = {
        updateOptions: () => {
          return Promise.reject({
            data: { message: 'error' },
          });
        },
      };

      return new VariableEditorCtrl(scope, {}, variableSrv, {});
    });

    it('should emit an error', () => {
      return scope.runQuery().then(res => {
        expect(mockEmit).toBeCalled();
        expect(mockEmit.mock.calls[0][0]).toBe('alert-error');
        expect(mockEmit.mock.calls[0][1][0]).toBe('Templating');
        expect(mockEmit.mock.calls[0][1][1]).toBe('Template variables could not be initialized: error');
      });
    });
  });
});
