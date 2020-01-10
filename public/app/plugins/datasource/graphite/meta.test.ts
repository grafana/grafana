import { parseSchemaRetentions } from './meta';

describe('metadata parsing', () => {
  it('should parse schema retentions', () => {
    const retentions = '1s:35d:20min:5:1542274085,1min:38d:2h:1:true,10min:120d:6h:1:true,2h:2y:6h:2';
    const info = parseSchemaRetentions(retentions);
    expect(info).toMatchInlineSnapshot(`
      Array [
        Object {
          "chunkspan": "20min",
          "interval": "1s",
          "numchunks": 5,
          "ready": 1542274085,
          "retention": "35d",
        },
        Object {
          "chunkspan": "2h",
          "interval": "1min",
          "numchunks": 1,
          "ready": true,
          "retention": "38d",
        },
        Object {
          "chunkspan": "6h",
          "interval": "10min",
          "numchunks": 1,
          "ready": true,
          "retention": "120d",
        },
        Object {
          "chunkspan": "6h",
          "interval": "2h",
          "numchunks": 2,
          "ready": undefined,
          "retention": "2y",
        },
      ]
    `);
  });
});
