import { clockPanelMetaCDN, v0alpha1Response } from '../test-fixtures/v0alpha1Response';

import { isCorePlugin, isDecoupledCorePlugin } from './shared';

const prometheusResponse = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'prometheus')!;

describe('isCorePlugin', () => {
  it('should return true for core plugins', () => {
    expect(isCorePlugin(prometheusResponse.spec)).toBe(true);
  });

  it('should return false for non core plugins', () => {
    expect(isCorePlugin(clockPanelMetaCDN.spec)).toBe(false);
  });
});

describe('isDecoupledCorePlugin', () => {
  it('should return false for core plugins that are not decoupled', () => {
    expect(isDecoupledCorePlugin(prometheusResponse.spec)).toBe(false);
  });

  it('should return false for non core plugins', () => {
    expect(isDecoupledCorePlugin(clockPanelMetaCDN.spec)).toBe(false);
  });
});
