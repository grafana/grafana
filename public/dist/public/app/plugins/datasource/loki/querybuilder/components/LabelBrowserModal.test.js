import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createLokiDatasource } from '../../mocks';
import { LabelBrowserModal } from './LabelBrowserModal';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn() })));
describe('LabelBrowserModal', () => {
    let datasource, props;
    beforeEach(() => {
        datasource = createLokiDatasource();
        props = {
            isOpen: true,
            datasource: datasource,
            query: {},
            onClose: jest.fn(),
            onChange: jest.fn(),
            onRunQuery: jest.fn(),
        };
        jest.spyOn(datasource, 'metadataRequest').mockResolvedValue({});
    });
    it('renders the label browser modal when open', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(LabelBrowserModal, Object.assign({}, props)));
        yield waitFor(() => {
            expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
        });
        expect(screen.getByRole('heading', { name: /label browser/i })).toBeInTheDocument();
    }));
    it("doesn't render the label browser modal when closed", () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(LabelBrowserModal, Object.assign({}, props, { isOpen: false })));
        expect(screen.queryByRole('heading', { name: /label browser/i })).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=LabelBrowserModal.test.js.map