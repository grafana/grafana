import { createColors } from './createColors';

describe('createColors', () => {
  it('Should enrich colors', () => {
    const colors = createColors({});
    expect(colors.primary.name).toBe('primary');
  });

  it('Should allow overrides', () => {
    const colors = createColors({
      primary: {
        main: 'pink',
      },
    });
    expect(colors.primary.main).toBe('pink');
  });
});
