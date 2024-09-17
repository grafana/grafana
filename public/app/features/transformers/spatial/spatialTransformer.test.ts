import { FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe/processDataFrame';
import { DataTransformerID } from '@grafana/data/src/transformations/transformers/ids';
import { frameAsGazetter } from 'app/features/geo/gazetteer/gazetteer';

describe('spatial transformer', () => {
  it('adds lat/lon based on string field', async () => {
    const cfg = {
      id: DataTransformerID.spatial,
      options: {
        lookupField: 'location',
        gazetteer: 'public/gazetteer/usa-states.json',
      },
    };
    const data = toDataFrame({
      name: 'locations',
      fields: [
        { name: 'location', type: FieldType.string, values: ['AL', 'AK', 'Arizona', 'Arkansas', 'Somewhere'] },
        { name: 'values', type: FieldType.number, values: [0, 10, 5, 1, 5] },
      ],
    });

    const matcher = fieldMatchers.get(FieldMatcherID.byName).get(cfg.options?.lookupField);

    const frame = toDataFrame({
      fields: [
        { name: 'id', values: ['AL', 'AK', 'AZ'] },
        { name: 'name', values: ['Alabama', 'Arkansas', 'Arizona'] },
        { name: 'lng', values: [-80.891064, -100.891064, -111.891064] },
        { name: 'lat', values: [12.448457, 24.448457, 33.448457] },
      ],
    });
    const gaz = frameAsGazetter(frame, { path: 'path/to/gaz.json' });

    // TODO!!!!!
    expect(gaz).toBeDefined();
    expect(matcher).toBeDefined();
    expect(data).toBeDefined();
  });
});
