import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { default as React, useState } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import 'whatwg-fetch';
import { PayloadEditor, RESET_TO_DEFAULT } from './PayloadEditor';
const DEFAULT_PAYLOAD = `[
  {
    "annotations": {
      "summary": "Instance instance1 has been down for more than 5 minutes"
    },
    "labels": {
      "instance": "instance1"
    },
    "startsAt": "2023-04-25T15:28:56.440Z"
  }]
`;
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { CodeEditor: function CodeEditor({ value, onBlur }) {
        return React.createElement("input", { "data-testid": "mockeditor", value: value, onChange: (e) => onBlur(e.currentTarget.value) });
    } })));
jest.mock('react-virtualized-auto-sizer', () => {
    return ({ children }) => children({ height: 1, width: 1 });
});
const PayloadEditorWithState = () => {
    const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
    return (React.createElement(PayloadEditor, { payload: payload, setPayload: setPayload, defaultPayload: DEFAULT_PAYLOAD, setPayloadFormatError: jest.fn(), payloadFormatError: null, onPayloadError: jest.fn() }));
};
const renderWithProvider = () => {
    const store = configureStore();
    render(React.createElement(Provider, { store: store },
        React.createElement(PayloadEditorWithState, null)));
};
describe('Payload editor', () => {
    it('Should render default payload by default', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProvider();
        yield waitFor(() => {
            expect(screen.getByTestId('mockeditor')).toHaveValue(`[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]`);
        });
    }));
    it('Should render default payload after clicking reset to default button', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProvider();
        yield waitFor(() => {
            expect(screen.getByTestId('mockeditor')).toHaveValue('[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]');
        });
        yield userEvent.type(screen.getByTestId('mockeditor'), 'this is the something');
        expect(screen.getByTestId('mockeditor')).toHaveValue('[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]this is the something');
        yield userEvent.click(screen.getByText(RESET_TO_DEFAULT));
        yield waitFor(() => expect(screen.queryByTestId('mockeditor')).toHaveValue('[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]'));
    }));
});
//# sourceMappingURL=PayloadEditor.test.js.map