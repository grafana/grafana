import { notFoundToNullOrThrow } from './util';

describe('notFoundToNull', () => {
  it('should convert notFound error to null', () => {
    const fetchError = {
      status: 404,
      data: null,
    };

    expect(notFoundToNullOrThrow(fetchError)).toBe(null);
  });

  it('should not catch any non-404 error', () => {
    const fetchError = {
      status: 500,
      data: null,
    };

    expect(() => {
      notFoundToNullOrThrow(fetchError);
    }).toThrow();
  });
});
