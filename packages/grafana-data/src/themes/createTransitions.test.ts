import { createTransitions } from './createTransitions';

describe('transitions', () => {
  const { duration, easing, getAutoHeightDuration, create } = createTransitions();

  describe('create() function', () => {
    it('should create default transition without arguments', () => {
      const transition = create();
      expect(transition).toEqual(`all ${duration.standard}ms ${easing.easeInOut} 0ms`);
    });

    it('should take string props as a first argument', () => {
      const transition = create('color');
      expect(transition).toEqual(`color ${duration.standard}ms ${easing.easeInOut} 0ms`);
    });

    it('should also take array of props as first argument', () => {
      const options = { delay: 20 };
      const multiple = create(['color', 'size'], options);
      const single1 = create('color', options);
      const single2 = create('size', options);
      const expected = `${single1},${single2}`;
      expect(multiple).toEqual(expected);
    });

    it('should optionally accept number "duration" option in second argument', () => {
      const transition = create('font', { duration: 500 });
      expect(transition).toEqual(`font 500ms ${easing.easeInOut} 0ms`);
    });

    it('should optionally accept string "duration" option in second argument', () => {
      const transition = create('font', { duration: '500ms' });
      expect(transition).toEqual(`font 500ms ${easing.easeInOut} 0ms`);
    });

    it('should round decimal digits of "duration" prop to whole numbers', () => {
      const transition = create('font', { duration: 12.125 });
      expect(transition).toEqual(`font 12ms ${easing.easeInOut} 0ms`);
    });

    it('should optionally accept string "easing" option in second argument', () => {
      const transition = create('transform', { easing: easing.sharp });
      expect(transition).toEqual(`transform ${duration.standard}ms ${easing.sharp} 0ms`);
    });

    it('should optionally accept number "delay" option in second argument', () => {
      const transition = create('size', { delay: 150 });
      expect(transition).toEqual(`size ${duration.standard}ms ${easing.easeInOut} 150ms`);
    });

    it('should optionally accept string "delay" option in second argument', () => {
      const transition = create('size', { delay: '150ms' });
      expect(transition).toEqual(`size ${duration.standard}ms ${easing.easeInOut} 150ms`);
    });

    it('should round decimal digits of "delay" prop to whole numbers', () => {
      const transition = create('size', { delay: 1.547 });
      expect(transition).toEqual(`size ${duration.standard}ms ${easing.easeInOut} 2ms`);
    });

    it('should return NaN when passed a negative number', () => {
      const zeroHeightDurationNegativeOne = getAutoHeightDuration(-1);
      // eslint-disable-next-line no-restricted-globals
      expect(isNaN(zeroHeightDurationNegativeOne)).toEqual(true);
      const zeroHeightDurationSmallNegative = getAutoHeightDuration(-0.000001);
      // eslint-disable-next-line no-restricted-globals
      expect(isNaN(zeroHeightDurationSmallNegative)).toEqual(true);
      const zeroHeightDurationBigNegative = getAutoHeightDuration(-100000);
      // eslint-disable-next-line no-restricted-globals
      expect(isNaN(zeroHeightDurationBigNegative)).toEqual(true);
    });

    it('should return values for pre-calculated positive examples', () => {
      let zeroHeightDuration = getAutoHeightDuration(14);
      expect(zeroHeightDuration).toEqual(159);
      zeroHeightDuration = getAutoHeightDuration(100);
      expect(zeroHeightDuration).toEqual(239);
      zeroHeightDuration = getAutoHeightDuration(0.0001);
      expect(zeroHeightDuration).toEqual(46);
      zeroHeightDuration = getAutoHeightDuration(100000);
      expect(zeroHeightDuration).toEqual(6685);
    });
  });
});
