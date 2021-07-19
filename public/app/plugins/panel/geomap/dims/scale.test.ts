import { validateScaleConfig } from './scale';

describe('scale dimensions', () => {
  it('should validate empty input', () => {
    const out = validateScaleConfig({} as any, {
      min: 5,
      max: 10,
    });
    expect(out).toMatchInlineSnapshot(`
      Object {
        "fixed": 2.5,
        "max": 10,
        "min": 2.5,
      }
    `);
  });

  it('should assert min<max', () => {
    const out = validateScaleConfig(
      {
        max: -3,
        min: 7,
        fixed: 100,
      },
      {
        min: 5,
        max: 10,
      }
    );
    expect(out).toMatchInlineSnapshot(`
      Object {
        "fixed": 7,
        "max": 7,
        "min": 5,
      }
    `);
  });
});
