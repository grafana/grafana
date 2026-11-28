import { FieldType } from '../types/dataFrame';

import { FieldCache } from './FieldCache';
import { toDataFrame } from './processDataFrame';

describe('FieldCache', () => {
  describe('a frame holding differently typed fields', () => {
    const presentTypes = [FieldType.time, FieldType.string, FieldType.number, FieldType.boolean, FieldType.other];
    const expectedFieldNames = ['time', 'string', 'number', 'boolean', 'other', 'undefined'];
    let fieldCache: FieldCache;

    beforeEach(() => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'string', type: FieldType.string },
          { name: 'number', type: FieldType.number },
          { name: 'boolean', type: FieldType.boolean },
          { name: 'other', type: FieldType.other },
          { name: 'undefined' },
        ],
      });
      fieldCache = new FieldCache(frame);
    });

    it('exposes every field in declaration order, tagged with its position', () => {
      expect(fieldCache.fields.map((f) => [f.name, f.index])).toEqual([
        ['time', 0],
        ['string', 1],
        ['number', 2],
        ['boolean', 3],
        ['other', 4],
        ['undefined', 5],
      ]);
      expect(fieldCache.getFields().map((f) => f.name)).toEqual(expectedFieldNames);
    });

    it('groups fields by type, with the field left untyped grouped under "other"', () => {
      expect(presentTypes.map((type) => fieldCache.getFields(type).map((f) => f.name))).toEqual([
        ['time'],
        ['string'],
        ['number'],
        ['boolean'],
        ['other', 'undefined'],
      ]);
      expect(fieldCache.getFields(FieldType.trace)).toEqual([]);
    });

    it('reports the types the frame contains', () => {
      expect(presentTypes.map((type) => [type, fieldCache.hasFieldOfType(type)])).toEqual([
        ['time', true],
        ['string', true],
        ['number', true],
        ['boolean', true],
        ['other', true],
      ]);
    });

    it('answers hasFieldOfType with undefined, not false, for an absent type', () => {
      // hasFieldOfType is declared to return boolean, but it indexes fieldByType without a
      // guard, so a missing key short-circuits to undefined. Pinned as the shipped behaviour.
      expect(fieldCache.hasFieldOfType(FieldType.trace)).toBeUndefined();
    });

    it('matches field names exactly, not by prefix', () => {
      const lookups = [...expectedFieldNames, 'tim', ''];
      expect(lookups.map((name) => [name, fieldCache.hasFieldNamed(name)])).toEqual([
        ['time', true],
        ['string', true],
        ['number', true],
        ['boolean', true],
        ['other', true],
        ['undefined', true],
        ['tim', false],
        ['', false],
      ]);
    });

    it('returns the first field of each type', () => {
      expect(presentTypes.map((type) => fieldCache.getFirstFieldOfType(type)?.name)).toEqual([
        'time',
        'string',
        'number',
        'boolean',
        'other',
      ]);
    });

    it('looks a field up by name, keeping its position', () => {
      expect(expectedFieldNames.map((name) => fieldCache.getFieldByName(name)?.index)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(fieldCache.getFieldByName('null')).toBeUndefined();
    });
  });

  describe('field retrieval', () => {
    let fieldCache: FieldCache;

    beforeEach(() => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [4, 5, 6] },
        ],
      });

      // Because we're using duplicate field names in the test case, we need to disable the warning,
      // so it doesn't show up in the test output
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fieldCache = new FieldCache(frame);
      consoleWarnSpy.mockRestore();
    });

    it('should get the first field with a duplicate name', () => {
      const field = fieldCache.getFieldByName('value');
      expect(field!.name).toEqual('value');
      expect(field!.values).toEqual([1, 2, 3]);
    });

    it('should return index of the field', () => {
      const field = fieldCache.getFirstFieldOfType(FieldType.number);
      expect(field!.index).toEqual(2);
    });
  });

  describe('getFirstFieldOfType', () => {
    let fieldCache: FieldCache;
    beforeEach(() => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      fieldCache = new FieldCache(frame);
    });

    it('should return undefined if type is not present', () => {
      const field = fieldCache.getFirstFieldOfType(FieldType.string);
      expect(field).toBeUndefined();
    });
  });
});
