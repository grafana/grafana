import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';
import { setTemplateSrv } from '@grafana/runtime';
import { TraceqlSearchScope } from '../dataquery.gen';
import TempoLanguageProvider from '../language_provider';
import TagsInput from './TagsInput';
import { v1Tags, v2Tags } from './utils.test';
describe('TagsInput', () => {
    let templateSrv = initTemplateSrv('key', [{ name: 'templateVariable1' }, { name: 'templateVariable2' }]);
    let user;
    beforeEach(() => {
        setTemplateSrv(templateSrv);
        jest.useFakeTimers();
        // Need to use delay: null here to work with fakeTimers
        // see https://github.com/testing-library/user-event/issues/833
        user = userEvent.setup({ delay: null });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    describe('should render correct tags', () => {
        it('for API v1 tags', () => __awaiter(void 0, void 0, void 0, function* () {
            renderTagsInput(v1Tags);
            const tag = screen.getByText('Select tag');
            expect(tag).toBeInTheDocument();
            yield user.click(tag);
            jest.advanceTimersByTime(1000);
            yield waitFor(() => {
                expect(screen.getByText('foo')).toBeInTheDocument();
                expect(screen.getByText('bar')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable1')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable2')).toBeInTheDocument();
            });
        }));
        it('for API v2 tags with scope of resource', () => __awaiter(void 0, void 0, void 0, function* () {
            renderTagsInput(undefined, v2Tags, TraceqlSearchScope.Resource);
            const tag = screen.getByText('Select tag');
            expect(tag).toBeInTheDocument();
            yield user.click(tag);
            jest.advanceTimersByTime(1000);
            yield waitFor(() => {
                expect(screen.getByText('cluster')).toBeInTheDocument();
                expect(screen.getByText('container')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable1')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable2')).toBeInTheDocument();
            });
        }));
        it('for API v2 tags with scope of span', () => __awaiter(void 0, void 0, void 0, function* () {
            renderTagsInput(undefined, v2Tags, TraceqlSearchScope.Span);
            const tag = screen.getByText('Select tag');
            expect(tag).toBeInTheDocument();
            yield user.click(tag);
            jest.advanceTimersByTime(1000);
            yield waitFor(() => {
                expect(screen.getByText('db')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable1')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable2')).toBeInTheDocument();
            });
        }));
        it('for API v2 tags with scope of unscoped', () => __awaiter(void 0, void 0, void 0, function* () {
            renderTagsInput(undefined, v2Tags, TraceqlSearchScope.Unscoped);
            const tag = screen.getByText('Select tag');
            expect(tag).toBeInTheDocument();
            yield user.click(tag);
            jest.advanceTimersByTime(1000);
            yield waitFor(() => {
                expect(screen.getByText('cluster')).toBeInTheDocument();
                expect(screen.getByText('container')).toBeInTheDocument();
                expect(screen.getByText('db')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable1')).toBeInTheDocument();
                expect(screen.getByText('$templateVariable2')).toBeInTheDocument();
            });
        }));
    });
    const renderTagsInput = (tagsV1, tagsV2, scope) => {
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
        const filter = {
            id: 'id',
            valueType: 'string',
            scope,
        };
        render(React.createElement(TagsInput, { datasource: datasource, updateFilter: jest.fn, deleteFilter: jest.fn, filters: [filter], setError: function (error) {
                throw error;
            }, staticTags: [], isTagsLoading: false, query: '' }));
    };
});
//# sourceMappingURL=TagsInput.test.js.map