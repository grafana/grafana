import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { default as React } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';
import 'whatwg-fetch';
import { mockPreviewTemplateResponse, mockPreviewTemplateResponseRejected } from '../../mocks/templatesApi';
import { defaults, PREVIEW_NOT_AVAILABLE, TemplatePreview } from './TemplateForm';
const getProviderWraper = () => {
    return function Wrapper({ children }) {
        const store = configureStore();
        const formApi = useForm({ defaultValues: defaults });
        return (React.createElement(Provider, { store: store },
            React.createElement(FormProvider, Object.assign({}, formApi), children)));
    };
};
const server = setupServer();
beforeAll(() => {
    setBackendSrv(backendSrv);
    server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
    server.resetHandlers();
});
afterAll(() => {
    server.close();
});
describe('TemplatePreview component', () => {
    it('Should render error if payload has wrong format', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(TemplatePreview, { width: 50, payload: 'bla bla bla', templateName: "potato", payloadFormatError: 'Unexpected token b in JSON at position 0', setPayloadFormatError: jest.fn() }), { wrapper: getProviderWraper() });
        yield waitFor(() => {
            expect(screen.getByTestId('payloadJSON')).toHaveTextContent('Unexpected token b in JSON at position 0');
        });
    }));
    it('Should render error if payload is not an iterable', () => __awaiter(void 0, void 0, void 0, function* () {
        const setError = jest.fn();
        render(React.createElement(TemplatePreview, { width: 50, payload: '{"a":"b"}', templateName: "potato", payloadFormatError: 'Unexpected token b in JSON at position 0', setPayloadFormatError: setError }), { wrapper: getProviderWraper() });
        yield waitFor(() => {
            expect(setError).toHaveBeenCalledWith('alertList is not iterable');
        });
    }));
    it('Should render error if payload has wrong format rendering the preview', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(TemplatePreview, { width: 50, payload: 'potatos and cherries', templateName: "potato", payloadFormatError: 'Unexpected token b in JSON at position 0', setPayloadFormatError: jest.fn() }), {
            wrapper: getProviderWraper(),
        });
        yield waitFor(() => {
            expect(screen.getByTestId('payloadJSON')).toHaveTextContent('Unexpected token b in JSON at position 0');
        });
    }));
    it('Should render error in preview response , if payload has correct format but preview request has been rejected', () => __awaiter(void 0, void 0, void 0, function* () {
        mockPreviewTemplateResponseRejected(server);
        render(React.createElement(TemplatePreview, { width: 50, payload: '[{"a":"b"}]', templateName: "potato", payloadFormatError: null, setPayloadFormatError: jest.fn() }), { wrapper: getProviderWraper() });
        yield waitFor(() => {
            expect(screen.getByTestId('payloadJSON')).toHaveTextContent(PREVIEW_NOT_AVAILABLE);
        });
    }));
    it('Should render preview response , if payload has correct ', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = {
            results: [
                { name: 'template1', text: 'This is the template result bla bla bla' },
                { name: 'template2', text: 'This is the template2 result bla bla bla' },
            ],
        };
        mockPreviewTemplateResponse(server, response);
        render(React.createElement(TemplatePreview, { width: 50, payload: '[{"a":"b"}]', templateName: "potato", payloadFormatError: null, setPayloadFormatError: jest.fn() }), { wrapper: getProviderWraper() });
        yield waitFor(() => {
            expect(screen.getByTestId('payloadJSON')).toHaveTextContent('Preview for template1: ======================>This is the template result bla bla bla<====================== Preview for template2: ======================>This is the template2 result bla bla bla<======================');
        });
    }));
    it('Should render preview response with some errors,  if payload has correct format ', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = {
            results: [{ name: 'template1', text: 'This is the template result bla bla bla' }],
            errors: [
                { name: 'template2', message: 'Unexpected "{" in operand', kind: 'kind_of_error' },
                { name: 'template3', kind: 'kind_of_error', message: 'Unexpected "{" in operand' },
            ],
        };
        mockPreviewTemplateResponse(server, response);
        render(React.createElement(TemplatePreview, { width: 50, payload: '[{"a":"b"}]', templateName: "potato", payloadFormatError: null, setPayloadFormatError: jest.fn() }), { wrapper: getProviderWraper() });
        yield waitFor(() => {
            expect(screen.getByTestId('payloadJSON')).toHaveTextContent('======================>This is the template result bla bla bla<====================== ERROR in template2: kind_of_error Unexpected "{" in operand ERROR in template3: kind_of_error Unexpected "{" in operand');
        });
    }));
});
//# sourceMappingURL=TemplatePreview.test.js.map