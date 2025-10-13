import { generateId, getLastId } from './generateId';

describe('getLastId::', () => {
  it('should return the last known generated id', () => {
    expect(getLastId()).toEqual(0);
  });
});

describe('generateId::', () => {
  it('should generate a new id on every call', () => {
    expect(generateId()).toEqual(1);
    expect(generateId()).toEqual(2);
    expect(generateId()).toEqual(3);
    expect(getLastId()).toEqual(3);
  });
});
