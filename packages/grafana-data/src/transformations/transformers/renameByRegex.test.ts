import { DataTransformerConfig, DataTransformerID, FieldType, toDataFrame, transformDataFrame } from '@grafana/data';
import { renameByRegexTransformer, RenameByRegexTransformerOptions } from './renameByRegex';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

describe('Rename By Regex Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([renameByRegexTransformer]);
  });

  describe('when regex and replacement pattern', () => {
    const data = toDataFrame({
      name: 'web-01.example.com',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'value', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
      ],
    });

    it('should rename matches using references', async () => {
      const cfg: DataTransformerConfig<RenameByRegexTransformerOptions> = {
        id: DataTransformerID.renameByRegex,
        options: {
          regex: '([^.]+).example.com',
          renamePattern: '$1',
        },
      };
      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith(received => {
        const data = received[0];
        const frame = data[0];
        expect(frame.name).toBe('web-01');
      });
    });

    it('should not rename misses', async () => {
      const cfg: DataTransformerConfig<RenameByRegexTransformerOptions> = {
        id: DataTransformerID.renameByRegex,
        options: {
          regex: '([^.]+).bad-domain.com',
          renamePattern: '$1',
        },
      };
      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith(received => {
        const data = received[0];
        const frame = data[0];
        expect(frame.name).toBe('web-01.example.com');
      });
    });

    it('should not rename with empty regex and repacement pattern', async () => {
      const cfg: DataTransformerConfig<RenameByRegexTransformerOptions> = {
        id: DataTransformerID.renameByRegex,
        options: {
          regex: '',
          renamePattern: '',
        },
      };
      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith(received => {
        const data = received[0];
        const frame = data[0];
        expect(frame.name).toBe('web-01.example.com');
      });
    });
  });
});
