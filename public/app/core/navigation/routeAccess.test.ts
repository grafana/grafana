import { routeAccess } from './routeAccess';

describe('routeAccess', () => {
  it('returns no role requirements when the predicate grants access', () => {
    expect(routeAccess(() => true)()).toEqual([]);
  });

  it('returns an unsatisfiable role when the predicate denies access', () => {
    expect(routeAccess(() => false)()).toEqual(['Reject']);
  });

  it('evaluates the predicate on every call', () => {
    let allowed = false;
    const roles = routeAccess(() => allowed);

    expect(roles()).toEqual(['Reject']);
    allowed = true;
    expect(roles()).toEqual([]);
  });
});
