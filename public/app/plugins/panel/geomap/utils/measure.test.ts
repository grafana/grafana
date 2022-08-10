import { measures } from './measure';

describe('get measure utils', () => {
  it('switch from length to area', () => {
    const length = measures[0];
    expect(length.value).toBe('length');
    expect(length.getUnit('ft').value).toBe('ft');
    expect(length.getUnit('ft2').value).toBe('ft');
  });
  it('switch from area to length', () => {
    const area = measures[1];
    expect(area.value).toBe('area');
    expect(area.getUnit('ft2').value).toBe('ft2');
    expect(area.getUnit('ft').value).toBe('ft2');
  });
});
