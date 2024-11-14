import { createColors } from './createColors';

describe('createColors', () => {
  it('Should enrich colors', () => {
    const palette = createColors({});
    expect(palette.primary.name).toBe('primary');
  });

  it('Should allow overrides', () => {
    const palette = createColors({
      primary: {
        main: '#FF0000',
      },
    });
    expect(palette.primary.main).toBe('#FF0000');
  });
});
