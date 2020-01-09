import { parseSchemaRetentions } from './meta';

describe('metadata parsing', () => {
  it('should parse schema retentions', () => {
    const retentions = '1s:35d:20min:5:1542274085,1min:38d:2h:1:true,10min:120d:6h:1:true,2h:2y:6h:2';
    const info = parseSchemaRetentions(retentions);
    expect(info).toMatchInlineSnapshot(`
      Array [
        Object {
          "resolution": "1s",
          "savedFor": "35d",
          "window": "20min",
          "xxx": "5",
          "yyy": "1542274085",
        },
        Object {
          "resolution": "1min",
          "savedFor": "38d",
          "window": "2h",
          "xxx": "1",
          "yyy": "true",
        },
        Object {
          "resolution": "10min",
          "savedFor": "120d",
          "window": "6h",
          "xxx": "1",
          "yyy": "true",
        },
        Object {
          "resolution": "2h",
          "savedFor": "2y",
          "window": "6h",
          "xxx": "2",
          "yyy": undefined,
        },
      ]
    `);
  });
});
