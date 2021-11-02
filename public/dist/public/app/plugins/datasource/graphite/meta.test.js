import { parseSchemaRetentions } from './meta';
describe('metadata parsing', function () {
    it('should parse schema retentions', function () {
        var retentions = '1s:35d:20min:5:1542274085,1min:38d:2h:1:true,10min:120d:6h:1:true,2h:2y:6h:2';
        var info = parseSchemaRetentions(retentions);
        expect(info).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"chunkspan\": \"20min\",\n          \"interval\": \"1s\",\n          \"numchunks\": 5,\n          \"ready\": 1542274085,\n          \"retention\": \"35d\",\n        },\n        Object {\n          \"chunkspan\": \"2h\",\n          \"interval\": \"1min\",\n          \"numchunks\": 1,\n          \"ready\": true,\n          \"retention\": \"38d\",\n        },\n        Object {\n          \"chunkspan\": \"6h\",\n          \"interval\": \"10min\",\n          \"numchunks\": 1,\n          \"ready\": true,\n          \"retention\": \"120d\",\n        },\n        Object {\n          \"chunkspan\": \"6h\",\n          \"interval\": \"2h\",\n          \"numchunks\": 2,\n          \"ready\": undefined,\n          \"retention\": \"2y\",\n        },\n      ]\n    ");
    });
});
//# sourceMappingURL=meta.test.js.map