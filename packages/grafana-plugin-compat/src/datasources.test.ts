import { PLACEHOLDER } from './datasources';

describe('@grafana/plugin-compat/datasources', () => {
  it('resolves the entry point through the package build pipeline', () => {
    expect(PLACEHOLDER).toBe(true);
  });
});
