import { FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe/processDataFrame';
import { DataTransformerID } from '@grafana/data/src/transformations/transformers/ids';
import { frameAsGazetter } from 'app/features/geo/gazetteer/gazetteer';

describe('Set geometry', () => {
  it('adds lat/lon based on string field', async () => {
    const cfg = {
      id: DataTransformerID.setGeometry,
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

    const out = await setGeometryFromGazetteer([data], gaz, matcher)[0].fields;

    expect(out).toMatchInlineSnapshot(`
      Array [
        Object {
          "config": Object {},
          "name": "Geometry",
          "type": "geo",
          "values": Array [
            Point {
              "dispatching_": null,
              "disposed": false,
              "eventTarget_": undefined,
              "extentRevision_": -1,
              "extent_": Array [
                Infinity,
                Infinity,
                -Infinity,
                -Infinity,
              ],
              "flatCoordinates": Array [
                -9004752.054206103,
                1396788.7250766128,
              ],
              "layout": "XY",
              "listeners_": null,
              "ol_uid": "1",
              "on": [Function],
              "once": [Function],
              "pendingRemovals_": null,
              "revision_": 1,
              "simplifiedGeometryMaxMinSquaredTolerance": 0,
              "simplifiedGeometryRevision": 0,
              "simplifyTransformedInternal": [Function],
              "stride": 2,
              "un": [Function],
              "values_": null,
            },
            Point {
              "dispatching_": null,
              "disposed": false,
              "eventTarget_": undefined,
              "extentRevision_": -1,
              "extent_": Array [
                Infinity,
                Infinity,
                -Infinity,
                -Infinity,
              ],
              "flatCoordinates": Array [
                -11231141.870071575,
                2808150.5459182193,
              ],
              "layout": "XY",
              "listeners_": null,
              "ol_uid": "2",
              "on": [Function],
              "once": [Function],
              "pendingRemovals_": null,
              "revision_": 1,
              "simplifiedGeometryMaxMinSquaredTolerance": 0,
              "simplifiedGeometryRevision": 0,
              "simplifyTransformedInternal": [Function],
              "stride": 2,
              "un": [Function],
              "values_": null,
            },
            undefined,
            undefined,
            undefined,
          ],
        },
        Object {
          "config": Object {},
          "name": "location",
          "type": "string",
          "values": Array [
            "AL",
            "AK",
            "Arizona",
            "Arkansas",
            "Somewhere",
          ],
        },
        Object {
          "config": Object {},
          "name": "values",
          "state": Object {
            "displayName": "values",
          },
          "type": "number",
          "values": Array [
            0,
            10,
            5,
            1,
            5,
          ],
        },
      ]
    `);
  });
});
