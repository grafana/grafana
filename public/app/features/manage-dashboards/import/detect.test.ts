import { detectImportModel, getV1ResourceSpec } from './detect';

describe('import detect helpers', () => {
  it('detects v2 resource format', () => {
    const dashboard = { spec: { elements: {} } };
    expect(detectImportModel(dashboard)).toBe('v2-resource');
  });

  it('detects v2 spec format', () => {
    const dashboard = { elements: {} };
    expect(detectImportModel(dashboard)).toBe('v2-resource');
  });

  it('detects v1 resource format and extracts spec', () => {
    const dashboard = { spec: { title: 'v1' } };
    expect(detectImportModel(dashboard)).toBe('v1-resource');
    expect(getV1ResourceSpec(dashboard)).toEqual({ title: 'v1' });
  });

  it('detects classic format', () => {
    const dashboard = { title: 'v1' };
    expect(detectImportModel(dashboard)).toBe('classic');
  });
});
