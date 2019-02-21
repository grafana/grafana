import {
  actionCreatorFactory,
  resetAllActionCreatorTypes,
  noPayloadActionCreatorFactory,
  higherOrderActionCreatorFactory,
  noPayloadHigherOrderActionCreatorFactory,
} from './actionCreatorFactory';

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

const setup = (payload?: Dummy, id?: string) => {
  resetAllActionCreatorTypes();
  const actionCreator = actionCreatorFactory<Dummy>('dummy').create();
  const noPayloadactionCreator = noPayloadActionCreatorFactory('NoPayload').create();
  const higherOrderActionCreator = higherOrderActionCreatorFactory<Dummy>('higher-order-dummy').create();
  const noPayloadHigherOrderActionCreator = noPayloadHigherOrderActionCreatorFactory(
    'no-payload-higher-order'
  ).create();
  const result = actionCreator(payload);
  const noPayloadResult = noPayloadactionCreator();
  const higherOrderResult = higherOrderActionCreator(id)(payload);
  const noPayloadHigherOrderResult = noPayloadHigherOrderActionCreator(id)();

  return {
    actionCreator,
    noPayloadactionCreator,
    higherOrderActionCreator,
    noPayloadHigherOrderActionCreator,
    result,
    noPayloadResult,
    higherOrderResult,
    noPayloadHigherOrderResult,
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
        noPayloadActionCreatorFactory('DuMmY').create();
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

describe('higherOrderActionCreatorFactory', () => {
  describe('when calling create', () => {
    it('then it should create correct type string', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      const { higherOrderActionCreator, higherOrderResult } = setup(payload);

      expect(higherOrderActionCreator.type).toEqual('higher-order-dummy');
      expect(higherOrderResult.type).toEqual('higher-order-dummy');
    });

    it('then it should create correct payload', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      const { higherOrderResult } = setup(payload);

      expect(higherOrderResult.payload).toEqual(payload);
    });

    it('then it should create correct id', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      const { higherOrderResult } = setup(payload, 'SomeId');

      expect(higherOrderResult.id).toEqual('SomeId');
    });
  });

  describe('when calling create with existing type', () => {
    it('then it should throw error', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      setup(payload);

      expect(() => {
        higherOrderActionCreatorFactory('DuMmY').create();
      }).toThrow();
    });
  });
});

describe('noPayloadHigherOrderActionCreatorFactory', () => {
  describe('when calling create', () => {
    it('then it should create correct type string', () => {
      const { noPayloadHigherOrderActionCreator, noPayloadHigherOrderResult } = setup();

      expect(noPayloadHigherOrderActionCreator.type).toEqual('no-payload-higher-order');
      expect(noPayloadHigherOrderResult.type).toEqual('no-payload-higher-order');
    });

    it('then it should create correct payload', () => {
      const { noPayloadHigherOrderResult } = setup();

      expect(noPayloadHigherOrderResult.payload).toBeUndefined();
    });

    it('then it should create correct id', () => {
      const { noPayloadHigherOrderResult } = setup({} as Dummy, 'SomeId');

      expect(noPayloadHigherOrderResult.id).toEqual('SomeId');
    });
  });

  describe('when calling create with existing type', () => {
    it('then it should throw error', () => {
      const payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
      setup(payload);

      expect(() => {
        noPayloadHigherOrderActionCreatorFactory('DuMmY').create();
      }).toThrow();
    });
  });
});
