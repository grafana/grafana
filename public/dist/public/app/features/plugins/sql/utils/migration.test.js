import { QueryFormat } from '../types';
import migrateAnnotation from './migration';
describe('Annotation migration', () => {
    const annotation = {
        datasource: {
            uid: 'P4FDCC188E688367F',
            type: 'mysql',
        },
        enable: false,
        hide: false,
        iconColor: 'rgba(0, 211, 255, 1)',
        limit: 100,
        name: 'Single',
        rawQuery: "SELECT\n  createdAt as time,\n  'single' as text,\n hostname as tags\nFROM\n   grafana_metric\nWHERE\n  $__timeFilter(createdAt)\nORDER BY time\nLIMIT 1\n",
        showIn: 0,
        tags: [],
        type: 'tags',
    };
    it('should migrate from old format to new', () => {
        var _a, _b;
        const newAnnotationFormat = migrateAnnotation(annotation);
        expect((_a = newAnnotationFormat.target) === null || _a === void 0 ? void 0 : _a.format).toBe(QueryFormat.Table);
        expect((_b = newAnnotationFormat.target) === null || _b === void 0 ? void 0 : _b.rawSql).toBe(annotation.rawQuery);
    });
});
//# sourceMappingURL=migration.test.js.map