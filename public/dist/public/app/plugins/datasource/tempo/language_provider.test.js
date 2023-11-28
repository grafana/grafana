import { __awaiter } from "tslib";
import { v1Tags, v2Tags } from './SearchTraceQLEditor/utils.test';
import { TraceqlSearchScope } from './dataquery.gen';
import TempoLanguageProvider from './language_provider';
describe('Language_provider', () => {
    describe('should get correct metrics summary tags', () => {
        it('for API v1 tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(v1Tags);
            const tags = lp.getMetricsSummaryTags();
            expect(tags).toEqual(['bar', 'foo']);
        }));
        it('for API v2 intrinsic tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getMetricsSummaryTags(TraceqlSearchScope.Intrinsic);
            expect(tags).toEqual(['duration', 'kind', 'name', 'status']);
        }));
        it('for API v2 resource tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getMetricsSummaryTags(TraceqlSearchScope.Resource);
            expect(tags).toEqual(['cluster', 'container']);
        }));
        it('for API v2 span tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getMetricsSummaryTags(TraceqlSearchScope.Span);
            expect(tags).toEqual(['db']);
        }));
        it('for API v2 unscoped tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getMetricsSummaryTags(TraceqlSearchScope.Unscoped);
            expect(tags).toEqual(['cluster', 'container', 'db']);
        }));
    });
    describe('should get correct tags', () => {
        it('for API v1 tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(v1Tags);
            const tags = lp.getTags();
            expect(tags).toEqual(['bar', 'foo', 'status']);
        }));
        it('for API v2 resource tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getTags(TraceqlSearchScope.Resource);
            expect(tags).toEqual(['cluster', 'container']);
        }));
        it('for API v2 span tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getTags(TraceqlSearchScope.Span);
            expect(tags).toEqual(['db']);
        }));
        it('for API v2 unscoped tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getTags(TraceqlSearchScope.Unscoped);
            expect(tags).toEqual(['cluster', 'container', 'db']);
        }));
    });
    describe('should get correct traceql autocomplete tags', () => {
        it('for API v1 tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(v1Tags);
            const tags = lp.getTraceqlAutocompleteTags();
            expect(tags).toEqual(['bar', 'foo', 'status']);
        }));
        it('for API v2 resource tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Resource);
            expect(tags).toEqual(['cluster', 'container']);
        }));
        it('for API v2 span tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Span);
            expect(tags).toEqual(['db']);
        }));
        it('for API v2 unscoped tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Unscoped);
            expect(tags).toEqual(['cluster', 'container', 'db']);
        }));
        it('for API v2 tags with no scope', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getTraceqlAutocompleteTags();
            expect(tags).toEqual(['cluster', 'container', 'db']);
        }));
    });
    describe('should get correct autocomplete tags', () => {
        it('for API v1 tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(v1Tags);
            const tags = lp.getAutocompleteTags();
            expect(tags).toEqual(['bar', 'foo', 'status', 'status.code']);
        }));
        it('for API v2 tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const lp = setup(undefined, v2Tags);
            const tags = lp.getAutocompleteTags();
            expect(tags).toEqual(['cluster', 'container', 'db', 'duration', 'kind', 'name', 'status']);
        }));
    });
    const setup = (tagsV1, tagsV2) => {
        const datasource = {
            search: {
                filters: [],
            },
        };
        const lp = new TempoLanguageProvider(datasource);
        if (tagsV1) {
            lp.setV1Tags(tagsV1);
        }
        else if (tagsV2) {
            lp.setV2Tags(tagsV2);
        }
        datasource.languageProvider = lp;
        return lp;
    };
});
//# sourceMappingURL=language_provider.test.js.map