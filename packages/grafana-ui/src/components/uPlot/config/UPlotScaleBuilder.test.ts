import { optMinMax } from './UPlotScaleBuilder';

describe('UPlotScaleBuilder', () => {
  it('opt min max', () => {
    expect(7).toEqual(optMinMax('min', null, 7));
    expect(7).toEqual(optMinMax('min', undefined, 7));
    expect(7).toEqual(optMinMax('min', 20, 7));

    expect(7).toEqual(optMinMax('min', 7, null));
    expect(7).toEqual(optMinMax('min', 7, undefined));
    expect(7).toEqual(optMinMax('min', 7, 20));

    expect(7).toEqual(optMinMax('max', null, 7));
    expect(7).toEqual(optMinMax('max', undefined, 7));
    expect(7).toEqual(optMinMax('max', 5, 7));

    expect(7).toEqual(optMinMax('max', 7, null));
    expect(7).toEqual(optMinMax('max', 7, undefined));
    expect(7).toEqual(optMinMax('max', 7, 5));
  });
});
