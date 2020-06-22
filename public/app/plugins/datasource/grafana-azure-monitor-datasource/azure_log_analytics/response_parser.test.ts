import ResponseParser from './response_parser';
import { expect } from '../../../../../test/lib/common';

describe('createSchemaFunctions', () => {
  describe('when called and results have functions', () => {
    it('then it should return correct result', () => {
      const functions = [
        { name: 'some name', body: 'some body', displayName: 'some displayName', category: 'some category' },
      ];
      const parser = new ResponseParser({ functions });

      const results = parser.createSchemaFunctions();

      expect(results).toEqual({
        ['some name']: {
          Body: 'some body',
          DocString: 'some displayName',
          Folder: 'some category',
          FunctionKind: 'Unknown',
          InputParameters: [],
          Name: 'some name',
          OutputColumns: [],
        },
      });
    });
  });

  describe('when called and results have no functions', () => {
    it('then it should return an empty object', () => {
      const parser = new ResponseParser({});

      const results = parser.createSchemaFunctions();

      expect(results).toEqual({});
    });
  });
});
