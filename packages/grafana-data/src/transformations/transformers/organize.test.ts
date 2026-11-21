import { lastValueFrom } from 'rxjs';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { type DataFrame, FieldType } from '../../types/dataFrame';
import { type DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { createFieldReferenceResolver, getFieldReferences } from '../frameIdentity';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { OrderByMode, OrderByType } from './order';
import { organizeFieldsTransformer, type OrganizeFieldsTransformerOptions, renameReferencedKeys } from './organize';

describe('OrganizeFields Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([organizeFieldsTransformer]);
  });

  describe('when consistent data is received', () => {
    const data = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'temperature', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] },
        { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
      ],
    });

    it('should order and filter according to config', async () => {
      const cfg: DataTransformerConfig<OrganizeFieldsTransformerOptions> = {
        id: DataTransformerID.organize,
        options: {
          indexByName: {
            time: 2,
            temperature: 0,
            humidity: 1,
          },
          excludeByName: {
            time: true,
          },
          renameByName: {
            humidity: 'renamed_humidity',
          },
        },
      };

      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
        const organized = data[0];
        expect(organized.fields).toEqual([
          {
            config: {},
            labels: undefined,
            name: 'temperature',
            state: {
              displayName: 'temperature',
              multipleFrames: false,
            },
            type: FieldType.number,
            values: [10.3, 10.4, 10.5, 10.6],
          },
          {
            config: {
              displayName: 'renamed_humidity',
            },
            labels: undefined,
            name: 'humidity',
            state: {
              displayName: 'renamed_humidity',
              multipleFrames: false,
            },
            type: FieldType.number,
            values: [10000.3, 10000.4, 10000.5, 10000.6],
          },
        ]);
      });
    });

    it('should order and filter (inclusion) according to config', async () => {
      const cfg: DataTransformerConfig<OrganizeFieldsTransformerOptions> = {
        id: DataTransformerID.organize,
        options: {
          excludeByName: {},
          indexByName: {},
          includeByName: {
            time: true,
          },
          renameByName: {},
        },
      };

      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
        const organized = data[0];
        expect(organized.fields).toEqual([
          {
            config: {},
            name: 'time',
            type: FieldType.time,
            values: [3000, 4000, 5000, 6000],
            state: {
              displayName: 'time',
              multipleFrames: false,
            },
          },
        ]);
      });
    });
  });

  describe('when inconsistent data is received', () => {
    const data = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'pressure', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] },
        { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
      ],
    });

    it('should append fields missing in config at the end', async () => {
      const cfg: DataTransformerConfig<OrganizeFieldsTransformerOptions> = {
        id: DataTransformerID.organize,
        options: {
          indexByName: {
            time: 2,
            temperature: 0,
            humidity: 1,
          },
          excludeByName: {
            humidity: true,
          },
          renameByName: {
            time: 'renamed_time',
          },
        },
      };

      await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
        const data = received[0];
        const organized = data[0];
        expect(organized.fields).toEqual([
          {
            labels: undefined,
            config: {
              displayName: 'renamed_time',
            },
            name: 'time',
            state: {
              displayName: 'renamed_time',
              multipleFrames: false,
            },
            type: FieldType.time,
            values: [3000, 4000, 5000, 6000],
          },
          {
            config: {},
            labels: undefined,
            name: 'pressure',
            state: {
              displayName: 'pressure',
              multipleFrames: false,
            },
            type: FieldType.number,
            values: [10.3, 10.4, 10.5, 10.6],
          },
        ]);
      });
    });
  });

  describe('with field references', () => {
    const source = () =>
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'host', type: FieldType.string, values: ['web-1', 'db-1'] },
          { name: 'value', type: FieldType.number, values: [10, 20] },
          { name: 'region', type: FieldType.string, values: ['us', 'eu'] },
        ],
      });

    const withDisplayNames = (frame: DataFrame, displayNames: Record<string, string>): DataFrame => ({
      ...frame,
      fields: frame.fields.map((field) =>
        displayNames[field.name]
          ? { ...field, config: { ...field.config, displayName: displayNames[field.name] } }
          : field
      ),
    });

    const referencesFor = (frame: DataFrame) => {
      const references = getFieldReferences(frame);
      return Object.fromEntries(frame.fields.map((field, index) => [field.name, references[index]]));
    };

    const organize = async (frame: DataFrame, options: Partial<OrganizeFieldsTransformerOptions>) => {
      const [organized] = await lastValueFrom(
        transformDataFrame([{ id: DataTransformerID.organize, options: { excludeByName: {}, ...options } }], [frame])
      );
      return organized?.fields.map((field) => `${field.name}:${field.state?.displayName}`);
    };

    it('keeps hiding the field it was written for after another field takes its name', async () => {
      const swapped = withDisplayNames(source(), { host: 'region', region: 'host' });

      expect(
        await organize(swapped, { excludeByName: { host: true }, referenceByName: referencesFor(source()) })
      ).toEqual(['time:time', 'value:value', 'region:host']);
    });

    it('keeps the order it was written for after fields are renamed', async () => {
      const renamed = withDisplayNames(source(), { time: 'Timestamp', region: 'Region' });

      expect(
        await organize(renamed, {
          indexByName: { region: 0, time: 1, host: 2, value: 3 },
          referenceByName: referencesFor(source()),
        })
      ).toEqual(['region:Region', 'time:Timestamp', 'host:host', 'value:value']);
    });

    it('renames the field it was written for after it was renamed upstream', async () => {
      const renamed = withDisplayNames(source(), { host: 'Host name' });

      expect(
        await organize(renamed, { renameByName: { host: 'Server' }, referenceByName: referencesFor(source()) })
      ).toEqual(['time:time', 'host:Server', 'value:value', 'region:region']);
    });

    it('tells apart series by their labels after their display names change', async () => {
      const series = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1] },
          { name: 'Value', type: FieldType.number, values: [1], labels: { host: 'a' } },
          { name: 'Value', type: FieldType.number, values: [2], labels: { host: 'b' } },
        ],
      });
      const [, a, b] = getFieldReferences(series);
      const relabelled = {
        ...series,
        fields: series.fields.map((field, index) =>
          index === 2 ? { ...field, config: { displayName: 'Beta' } } : field
        ),
      };

      expect(
        await organize(relabelled, {
          excludeByName: { b: true },
          indexByName: { b: 0, a: 1 },
          referenceByName: { a, b },
        })
      ).toEqual(['Value:a', 'time:time']);
    });

    it('keeps matching fields whose missing labels became empty labels upstream', async () => {
      const emptied = { ...source(), fields: source().fields.map((field) => ({ ...field, labels: {} })) };

      expect(
        await organize(emptied, {
          excludeByName: { value: true },
          indexByName: { region: 0 },
          referenceByName: referencesFor(source()),
        })
      ).toEqual(['region:region', 'time:time', 'host:host']);
    });

    it('renames referenced keys to the names their fields have now and drops malformed references', () => {
      expect(
        renameReferencedKeys(
          {
            excludeByName: { host: true, gone: true, region: true, legacy: true },
            indexByName: { host: 0 },
            renameByName: {},
            referenceByName: { host: { name: 'host' }, gone: { name: 'gone' }, region: null } as never,
          },
          (reference) => (reference.name === 'host' ? 'Host name' : undefined),
          ['Host name', 'gone']
        )
      ).toEqual({
        excludeByName: { 'Host name': true, 'gone 1': true, region: true, legacy: true },
        indexByName: { 'Host name': 0 },
        renameByName: {},
        referenceByName: { 'Host name': { name: 'host' }, 'gone 1': { name: 'gone' } },
      });
    });

    it('skips re-keying when every reference already has its current name but still drops malformed ones', () => {
      const options = {
        excludeByName: { host: true },
        indexByName: { host: 0 },
        renameByName: {},
        referenceByName: { host: { name: 'host' } },
      };

      expect(renameReferencedKeys(options, (reference) => reference.name, ['host'])).toBe(options);
      expect(
        renameReferencedKeys(
          { ...options, referenceByName: { ...options.referenceByName, region: null } as never },
          (reference) => reference.name,
          ['host']
        ).referenceByName
      ).toEqual({ host: { name: 'host' } });
    });

    it('matches keys with malformed references by name', async () => {
      expect(
        await organize(withDisplayNames(source(), { host: 'Host name' }), {
          excludeByName: { host: true, region: true },
          referenceByName: { host: null, region: { name: 1 } } as never,
        })
      ).toEqual(['time:time', 'value:value']);
    });

    it('tells apart fields that share a name and labels', async () => {
      const repeated = toDataFrame({
        fields: [1, 2, 3].map((value) => ({ name: 'x', type: FieldType.number, values: [value] })),
      });
      const [, second, third] = getFieldReferences(repeated);

      const [organized] = await lastValueFrom(
        transformDataFrame(
          [
            {
              id: DataTransformerID.organize,
              options: {
                excludeByName: { 'x 2': true },
                indexByName: { 'x 3': 0 },
                referenceByName: { 'x 2': second, 'x 3': third },
              },
            },
          ],
          [repeated]
        )
      );
      expect(organized.fields.map((field) => field.values[0])).toEqual([3, 1]);
    });

    it('leaves other fields alone when the referenced field is gone', async () => {
      const renamed = withDisplayNames(source(), { region: 'host' });

      expect(
        await organize(
          { ...renamed, fields: renamed.fields.filter((field) => field.name !== 'host') },
          { excludeByName: { host: true }, indexByName: { host: 0 }, referenceByName: referencesFor(source()) }
        )
      ).toEqual(['time:time', 'value:value', 'region:host']);
    });

    it('keeps keys apart when the fields they reference share a display name', async () => {
      const shared = withDisplayNames(source(), { host: 'name', region: 'name' });
      const options = {
        excludeByName: { host: true },
        indexByName: {},
        renameByName: { region: 'Region' },
        referenceByName: { host: { name: 'host' }, region: { name: 'region' } },
      };
      const rekeyed = renameReferencedKeys(options, () => 'name', ['time', 'name', 'value', 'name']);

      expect(await organize(shared, rekeyed)).toEqual(['time:time', 'value:value', 'region:Region']);
    });

    it('keeps a key without a reference when a referenced field takes its name', async () => {
      const swapped = withDisplayNames(source(), { host: 'region', region: 'Region (old)' });
      const options = {
        excludeByName: { host: false, region: true },
        indexByName: {},
        renameByName: {},
        referenceByName: { host: { name: 'host' } },
      };
      const rekeyed = renameReferencedKeys(options, (reference) => (reference.name === 'host' ? 'region' : undefined), [
        'time',
        'region',
        'value',
        'Region (old)',
      ]);

      expect(await organize(swapped, rekeyed)).toEqual(['time:time', 'host:region', 'value:value']);
    });

    it('re-keys references without changing what the transformation outputs', async () => {
      let seed = 11;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
      const names = ['time', 'host', 'x', 'x', 'value'];
      const keys = ['time', 'host', 'x', 'x 1', 'x 2', 'value', 'Host name', 'gone'];
      const describeOutput = async (frame: DataFrame, options: OrganizeFieldsTransformerOptions) => {
        const output = await lastValueFrom(
          transformDataFrame([{ id: DataTransformerID.organize, options }], [structuredClone(frame)])
        );
        return output.map((organized) => organized.fields.map((field) => [field.values[0], field.state?.displayName]));
      };

      for (let run = 0; run < 300; run++) {
        const frame = toDataFrame({
          fields: Array.from({ length: 1 + Math.floor(random() * 5) }, (_, index) => ({
            name: pick(names),
            type: FieldType.number,
            values: [index],
            labels: random() < 0.3 ? { host: pick(['a', 'b']) } : undefined,
            config: random() < 0.5 ? { displayName: pick(keys) } : {},
          })),
        });
        const references = getFieldReferences(frame);
        const record = <T>(value: () => T) =>
          Object.fromEntries(Array.from({ length: Math.floor(random() * 4) }, () => [pick(keys), value()]));
        const options: OrganizeFieldsTransformerOptions = {
          excludeByName: record(() => random() < 0.7),
          indexByName: record(() => Math.floor(random() * 5)),
          renameByName: record(() => pick(['', 'renamed'])),
        };
        options.referenceByName = Object.fromEntries(
          [...Object.keys(options.excludeByName), ...Object.keys(options.indexByName ?? {})]
            .concat(Object.keys(options.renameByName))
            .filter(() => random() < 0.6)
            .map((key) => [key, random() < 0.8 ? pick(references) : { name: 'gone' }])
        );
        const resolve = createFieldReferenceResolver(frame);
        const displayName = (index: number) => getFieldDisplayName(frame.fields[index], frame, [frame]);
        const rekeyed = renameReferencedKeys(
          options,
          (reference) => {
            const index = resolve(reference);
            return index < 0 ? undefined : displayName(index);
          },
          frame.fields.map((_, index) => displayName(index))
        );

        expect(await describeOutput(frame, rekeyed)).toEqual(await describeOutput(frame, options));
      }
    });

    it('matches keys without a reference by name', async () => {
      expect(
        await organize(withDisplayNames(source(), { host: 'Host name' }), {
          excludeByName: { host: true, value: true },
          referenceByName: { host: referencesFor(source()).host },
        })
      ).toEqual(['time:time', 'region:region']);
    });

    it('lets a referenced key decide for its field over a key matched by name', async () => {
      const swapped = withDisplayNames(source(), { host: 'region', region: 'host' });

      expect(
        await organize(swapped, {
          excludeByName: { host: false, region: true },
          referenceByName: { host: referencesFor(source()).host },
        })
      ).toEqual(['time:time', 'host:region', 'value:value']);
    });

    it('includes the referenced fields', async () => {
      const references = referencesFor(source());
      const renamed = withDisplayNames(source(), { value: 'Requests' });

      expect(
        await organize(renamed, { includeByName: { value: true }, referenceByName: { value: references.value } })
      ).toEqual(['value:Requests']);
      expect(
        await organize(renamed, {
          includeByName: { value: true, time: true },
          referenceByName: { value: references.value },
        })
      ).toEqual(['time:time', 'value:Requests']);
    });

    it('drops a frame left without fields', async () => {
      const references = referencesFor(source());
      const output = await lastValueFrom(
        transformDataFrame(
          [
            {
              id: DataTransformerID.organize,
              options: {
                excludeByName: { time: true, host: true, value: true, region: true },
                referenceByName: references,
              },
            },
          ],
          [source()]
        )
      );
      expect(output).toEqual([]);
    });

    it('orders by name in auto mode and ignores referenced positions', async () => {
      expect(
        await organize(source(), {
          orderByMode: OrderByMode.Auto,
          orderBy: [{ type: OrderByType.Name }],
          indexByName: { value: 0 },
          referenceByName: referencesFor(source()),
        })
      ).toEqual(['time:time', 'host:host', 'region:region', 'value:value']);
    });

    it('matches the name based output when no key has a reference', async () => {
      const names = ['time', 'Time', 'Value', 'value', 'host', 'x', 'x', 'Renamed'];
      let seed = 7;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
      const keys = [...names, 'x 1', 'x 2', 'a', 'b', 'missing'];

      for (let run = 0; run < 200; run++) {
        const frame = () =>
          toDataFrame({
            fields: Array.from({ length: Math.floor(random() * 7) }, () => {
              const name = pick(names);
              return {
                name,
                type: name.toLowerCase() === 'time' ? FieldType.time : FieldType.number,
                values: [random()],
                labels: random() < 0.3 ? { host: pick(['a', 'b']) } : undefined,
                config: random() < 0.2 ? { displayName: pick(keys) } : {},
              };
            }),
          });
        const record = <T>(value: () => T) =>
          Object.fromEntries(Array.from({ length: Math.floor(random() * 4) }, () => [pick(keys), value()]));
        const options: OrganizeFieldsTransformerOptions = {
          excludeByName: record(() => random() < 0.7),
          includeByName: random() < 0.2 ? record(() => random() < 0.7) : {},
          indexByName: record(() => Math.floor(random() * 6)),
          renameByName: record(() => pick(['', 'renamed', 'other'])),
          orderByMode: random() < 0.1 ? OrderByMode.Auto : undefined,
        };
        const frames = [frame(), frame()].slice(0, 1 + Math.floor(random() * 2));
        const describeOutput = (output: DataFrame[]) =>
          output.map((f) => f.fields.map((field) => [field.name, field.labels, field.state?.displayName]));
        const legacy = await lastValueFrom(
          transformDataFrame([{ id: DataTransformerID.organize, options }], structuredClone(frames))
        );
        const referenced = await lastValueFrom(
          transformDataFrame(
            [
              {
                id: DataTransformerID.organize,
                options: { ...options, referenceByName: { unused: { name: 'unused' } } },
              },
            ],
            structuredClone(frames)
          )
        );
        expect(describeOutput(referenced)).toEqual(describeOutput(legacy));
      }
    });
  });
});
