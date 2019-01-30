import { actionCreatorFactory, resetAllActionCreatorTypes } from './actionCreatorFactory';

interface Dummy {
  n: number;
  s: string;
  o: {
    n: number;
    s: string;
    b: boolean;
  };
  b: boolean;
}

const setup = payload => {
  resetAllActionCreatorTypes();
  const actionCreator = actionCreatorFactory<Dummy>('dummy').create();
  const result = actionCreator(payload);

  return {
    actionCreator,
    result,
  };
};

describe('actionCreatorFactory', () => {
  describe('when calling create', () => {
    it('then it should create correct type string', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      const { actionCreator, result } = setup(payload);

      expect(actionCreator.type).toEqual('dummy');
      expect(result.type).toEqual('dummy');
    });

    it('then it should create correct payload', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      const { result } = setup(payload);

      expect(result.payload).toEqual(payload);
    });
  });

  describe('when calling create with existing type', () => {
    it('then it should throw error', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      setup(payload);

      expect(() => {
        actionCreatorFactory<Dummy>('dummy').create();
      }).toThrow();
    });
  });
});
