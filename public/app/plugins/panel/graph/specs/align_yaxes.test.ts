import { alignYLevel } from '../align_yaxes';

describe('Graph Y axes aligner', () => {
  let yaxes, expected;
  let alignY = 0;

  describe('on the one hand with respect to zero', () => {
    it('Should shrink Y axis', () => {
      yaxes = [
        { min: 5, max: 10 },
        { min: 2, max: 3 },
      ];
      expected = [
        { min: 5, max: 10 },
        { min: 1.5, max: 3 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axis', () => {
      yaxes = [
        { min: 2, max: 3 },
        { min: 5, max: 10 },
      ];
      expected = [
        { min: 1.5, max: 3 },
        { min: 5, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axis', () => {
      yaxes = [
        { min: -10, max: -5 },
        { min: -3, max: -2 },
      ];
      expected = [
        { min: -10, max: -5 },
        { min: -3, max: -1.5 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axis', () => {
      yaxes = [
        { min: -3, max: -2 },
        { min: -10, max: -5 },
      ];
      expected = [
        { min: -3, max: -1.5 },
        { min: -10, max: -5 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });
  });

  describe('on the opposite sides with respect to zero', () => {
    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -3, max: -1 },
        { min: 5, max: 10 },
      ];
      expected = [
        { min: -3, max: 3 },
        { min: -10, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: 1, max: 3 },
        { min: -10, max: -5 },
      ];
      expected = [
        { min: -3, max: 3 },
        { min: -10, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });
  });

  describe('both across zero', () => {
    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -10, max: 5 },
        { min: -2, max: 3 },
      ];
      expected = [
        { min: -10, max: 15 },
        { min: -2, max: 3 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -5, max: 10 },
        { min: -3, max: 2 },
      ];
      expected = [
        { min: -15, max: 10 },
        { min: -3, max: 2 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });
  });

  describe('one of graphs on zero', () => {
    it('Should shrink Y axes', () => {
      yaxes = [
        { min: 0, max: 3 },
        { min: 5, max: 10 },
      ];
      expected = [
        { min: 0, max: 3 },
        { min: 0, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: 5, max: 10 },
        { min: 0, max: 3 },
      ];
      expected = [
        { min: 0, max: 10 },
        { min: 0, max: 3 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -3, max: 0 },
        { min: -10, max: -5 },
      ];
      expected = [
        { min: -3, max: 0 },
        { min: -10, max: 0 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -10, max: -5 },
        { min: -3, max: 0 },
      ];
      expected = [
        { min: -10, max: 0 },
        { min: -3, max: 0 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });
  });

  describe('both graphs on zero', () => {
    it('Should shrink Y axes', () => {
      yaxes = [
        { min: 0, max: 3 },
        { min: -10, max: 0 },
      ];
      expected = [
        { min: -3, max: 3 },
        { min: -10, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -3, max: 0 },
        { min: 0, max: 10 },
      ];
      expected = [
        { min: -3, max: 3 },
        { min: -10, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });
  });

  describe('mixed placement of graphs relative to zero', () => {
    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -10, max: 5 },
        { min: 1, max: 3 },
      ];
      expected = [
        { min: -10, max: 5 },
        { min: -6, max: 3 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: 1, max: 3 },
        { min: -10, max: 5 },
      ];
      expected = [
        { min: -6, max: 3 },
        { min: -10, max: 5 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -10, max: 5 },
        { min: -3, max: -1 },
      ];
      expected = [
        { min: -10, max: 5 },
        { min: -3, max: 1.5 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      yaxes = [
        { min: -3, max: -1 },
        { min: -10, max: 5 },
      ];
      expected = [
        { min: -3, max: 1.5 },
        { min: -10, max: 5 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });
  });

  describe('on level not zero', () => {
    it('Should shrink Y axis', () => {
      alignY = 1;
      yaxes = [
        { min: 5, max: 10 },
        { min: 2, max: 4 },
      ];
      expected = [
        { min: 4, max: 10 },
        { min: 2, max: 4 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      alignY = 2;
      yaxes = [
        { min: -3, max: 1 },
        { min: 5, max: 10 },
      ];
      expected = [
        { min: -3, max: 7 },
        { min: -6, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      alignY = -1;
      yaxes = [
        { min: -5, max: 5 },
        { min: -2, max: 3 },
      ];
      expected = [
        { min: -5, max: 15 },
        { min: -2, max: 3 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });

    it('Should shrink Y axes', () => {
      alignY = -2;
      yaxes = [
        { min: -2, max: 3 },
        { min: 5, max: 10 },
      ];
      expected = [
        { min: -2, max: 3 },
        { min: -2, max: 10 },
      ];

      alignYLevel(yaxes, alignY);
      expect(yaxes).toMatchObject(expected);
    });
  });

  describe('on level not number value', () => {
    it('Should ignore without errors', () => {
      yaxes = [
        { min: 5, max: 10 },
        { min: 2, max: 4 },
      ];
      expected = [
        { min: 5, max: 10 },
        { min: 2, max: 4 },
      ];

      alignYLevel(yaxes, 'q');
      expect(yaxes).toMatchObject(expected);
    });
  });
});
