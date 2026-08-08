import { isValidGotoPath } from './routes';

describe('isValidGotoPath', () => {
  it('accepts a well-formed single-segment short URL', () => {
    expect(isValidGotoPath('/goto/abc123')).toBe(true);
    expect(isValidGotoPath('/goto/A_b-9')).toBe(true);
  });

  // Regression: a double slash makes the backend `/goto/:uid` route miss, so the SPA is served
  // back with a 404. Bouncing to the server here would loop forever, so these must be rejected.
  it('rejects a double-slash path', () => {
    expect(isValidGotoPath('/goto//a')).toBe(false);
  });

  it('rejects an empty uid', () => {
    expect(isValidGotoPath('/goto/')).toBe(false);
  });

  it('rejects extra path segments', () => {
    expect(isValidGotoPath('/goto/a/b')).toBe(false);
  });
});
