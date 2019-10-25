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

const setup = (payload?: Dummy) => {
  resetAllActionCreatorTypes();
  const actionCreator = actionCreatorFactory<Dummy>('dummy').create();
  const noPayloadactionCreator = actionCreatorFactory('NoPayload').create();
  const result = actionCreator(payload);
  const noPayloadResult = noPayloadactionCreator();

  return { actionCreator, noPayloadactionCreator, result, noPayloadResult };
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
        actionCreatorFactory('DuMmY').create();
      }).toThrow();
    });
  });
});

describe('noPayloadActionCreatorFactory', () => {
  describe('when calling create', () => {
    it('then it should create correct type string', () => {
      const { noPayloadResult, noPayloadactionCreator } = setup();

      expect(noPayloadactionCreator.type).toEqual('NoPayload');
      expect(noPayloadResult.type).toEqual('NoPayload');
    });

    it('then it should create correct payload', () => {
      const { noPayloadResult } = setup();

      expect(noPayloadResult.payload).toBeUndefined();
    });
  });

  describe('when calling create with existing type', () => {
    it('then it should throw error', () => {
      setup();

      expect(() => {
        actionCreatorFactory<Dummy>('nOpAyLoAd').create();
      }).toThrow();
    });
  });
});
