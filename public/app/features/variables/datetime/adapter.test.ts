import { variableAdapters } from '../adapters';
import { createDateTimeVariableAdapter } from './adapter';
import { textboxBuilder } from '../shared/testing/builders';
import { DateTimeVariableModel, initialVariableModelState, VariableHide } from '../types';

variableAdapters.setInit(() => [createDateTimeVariableAdapter()]);

describe('createDateTimeVariableAdapter', () => {
  describe('getSaveModel', () => {
    describe('when called and query differs from the original query and saving current as default', () => {
      it('then the model should be correct', () => {
        const variable: DateTimeVariableModel = {
          ...initialVariableModelState,
          id: 'query0',
          index: 0,
          type: 'datetime',
          name: 'query0',
          current: {
            value: '',
            text: '',
            selected: false,
          },
          options: [
            {
              selected: false,
              text: '1644966000000',
              value: '1644966000000',
            },
          ],
          query: '1645138799999',
          returnValue: 'end',
        };

        const adapter = variableAdapters.get('datetime');

        const result = adapter.getSaveModel(variable, true);
        expect(result).toEqual({
          name: 'query0',
          query: '1645138799999',
          current: { selected: false, text: '', value: '' },
          options: [{ selected: false, text: '1644966000000', value: '1644966000000' }],
          type: 'datetime',
          label: null,
          hide: VariableHide.dontHide,
          skipUrlSync: false,
          error: null,
          description: null,
          returnValue: 'end',
        });
      });
    });
  });

  describe('getValueForUrl', () => {
    describe('when called', () => {
      it('then current value should be returned', () => {
        const variable: DateTimeVariableModel = {
          ...initialVariableModelState,
          id: 'query0',
          index: 0,
          type: 'datetime',
          name: 'query0',
          current: {
            value: '1644966000000',
            text: '1644966000000',
            selected: false,
          },
          options: [
            {
              selected: false,
              text: '1644966000000',
              value: '1644966000000',
            },
          ],
          query: '1645138799999',
          returnValue: 'end',
        };

        const adapter = variableAdapters.get('datetime');

        const result = adapter.getValueForUrl(variable);
        expect(result).toEqual('1644966000000');
      });
    });
  });
});
