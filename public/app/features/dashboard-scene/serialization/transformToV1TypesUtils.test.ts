import { SpecialValueMatch as SpecialValueMatchV1 } from '@grafana/data';
import { MappingType as MappingTypeV1 } from '@grafana/schema';
import type { FieldConfigSource, SpecialValueMatch } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { transformMappingsToV1 } from './transformToV1TypesUtils';

describe('transformToV1TypesUtils', () => {
  describe('transformMappingsToV1', () => {
    function makeFieldConfig(mappings: FieldConfigSource['defaults']['mappings']): FieldConfigSource {
      return {
        defaults: { mappings },
        overrides: [],
      };
    }

    function makeSpecialMapping(match: SpecialValueMatch) {
      return {
        type: 'special' as const,
        options: { match, result: { text: 'mapped' } },
      };
    }

    it.each<{ v2: SpecialValueMatch; v1: SpecialValueMatchV1 }>([
      { v2: 'true', v1: SpecialValueMatchV1.True },
      { v2: 'false', v1: SpecialValueMatchV1.False },
      { v2: 'null', v1: SpecialValueMatchV1.Null },
      { v2: 'nan', v1: SpecialValueMatchV1.NaN },
      { v2: 'null+nan', v1: SpecialValueMatchV1.NullAndNaN },
      { v2: 'empty', v1: SpecialValueMatchV1.Empty },
    ])('should transform special value match "$v2" to V1', ({ v2, v1 }) => {
      const result = transformMappingsToV1(makeFieldConfig([makeSpecialMapping(v2)]));
      expect(result.defaults.mappings).toHaveLength(1);
      expect(result.defaults.mappings![0]).toMatchObject({
        type: MappingTypeV1.SpecialValue,
        options: { match: v1, result: { text: 'mapped' } },
      });
    });

    it('should drop special value mappings with unknown match type', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = transformMappingsToV1(makeFieldConfig([makeSpecialMapping('unknown_value' as SpecialValueMatch)]));

      expect(result.defaults.mappings).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith('Skipping special value mapping with unknown match type: "unknown_value"');
      warnSpy.mockRestore();
    });
  });
});
