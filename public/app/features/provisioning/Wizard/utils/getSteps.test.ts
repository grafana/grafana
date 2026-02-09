import { getSteps } from './getSteps';

describe('getSteps', () => {
  it('returns consistent step order across providers', () => {
    const expected = ['authType', 'connection', 'bootstrap', 'synchronize', 'finish'];

    expect(getSteps('local').map((s) => s.id)).toEqual(expected);
    expect(getSteps('git').map((s) => s.id)).toEqual(expected);
    expect(getSteps('gitlab').map((s) => s.id)).toEqual(expected);
    expect(getSteps('bitbucket').map((s) => s.id)).toEqual(expected);
    expect(getSteps('github', 'pat').map((s) => s.id)).toEqual(expected);
    expect(getSteps('github', 'github-app').map((s) => s.id)).toEqual(expected);
  });
});
