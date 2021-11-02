import { __awaiter, __generator } from "tslib";
import React from 'react';
import PageHeader from './PageHeader';
import { render, screen } from '@testing-library/react';
describe('PageHeader', function () {
    describe('when the nav tree has a node with a title', function () {
        it('should render the title', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nav;
            return __generator(this, function (_a) {
                nav = {
                    main: {
                        icon: 'folder-open',
                        id: 'node',
                        subTitle: 'node subtitle',
                        url: '',
                        text: 'node',
                    },
                    node: {},
                };
                render(React.createElement(PageHeader, { model: nav }));
                expect(screen.getByRole('heading', { name: 'node' })).toBeInTheDocument();
                return [2 /*return*/];
            });
        }); });
    });
    describe('when the nav tree has a node with breadcrumbs and a title', function () {
        it('should render the title with breadcrumbs first and then title last', function () { return __awaiter(void 0, void 0, void 0, function () {
            var nav;
            return __generator(this, function (_a) {
                nav = {
                    main: {
                        icon: 'folder-open',
                        id: 'child',
                        subTitle: 'child subtitle',
                        url: '',
                        text: 'child',
                        breadcrumbs: [{ title: 'Parent', url: 'parentUrl' }],
                    },
                    node: {},
                };
                render(React.createElement(PageHeader, { model: nav }));
                expect(screen.getByRole('heading', { name: 'Parent / child' })).toBeInTheDocument();
                expect(screen.getByRole('link', { name: 'Parent' })).toBeInTheDocument();
                return [2 /*return*/];
            });
        }); });
    });
});
//# sourceMappingURL=PageHeader.test.js.map