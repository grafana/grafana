import { getIntegrationType, isValidIntegrationType } from './grafana';

describe('getIntegrationType method', () => {
  it('should return the integration name when it is a valid type name with [{number}] ', () => {
    const name = getIntegrationType('coolIntegration[1]');
    expect(name).toBe('coolIntegration');

    const name2 = getIntegrationType('coolIntegration[6767]');
    expect(name2).toBe('coolIntegration');
  });
  it('should return the integration name when it is a valid type name without [{number}] ', () => {
    const name = getIntegrationType('coolIntegration');
    expect(name).toBe('coolIntegration');
  });
  it('should return undefined when it is a invalid type name ', () => {
    const name = getIntegrationType('coolIntegration[345vadkfjgh');
    expect(name).toBe(undefined);
  });
});
describe('isValidIntegrationType method', () => {
  it('should return true when it is a name followed with [{number}] ', () => {
    const name = isValidIntegrationType('coolIntegration[1]');
    expect(name).toBe(true);
  });
  it('should return true when it is a name without [{number}] ', () => {
    const name = isValidIntegrationType('coolIntegration');
    expect(name).toBe(true);
  });
  it('should return false when it is a name followed with [{wrong index}] ', () => {
    const name = isValidIntegrationType('coolIntegration[1123sfsf]');
    expect(name).toBe(false);
  });
  it('should return false when it is a name followed with [{index} ', () => {
    const name = isValidIntegrationType('coolIntegration[11');
    expect(name).toBe(false);
  });
});
