import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { default as React, useState } from 'react';
import { Provider } from 'react-redux';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import 'whatwg-fetch';
import { TemplateDefaultPayloadResponse } from '../../api/templateApi';
import { mockDefaultPayloadResponse, mockDefaultPayloadResponseRejected } from '../../mocks/templatesApi';

import { NO_DEFAULT_PAYLOAD, PayloadEditor, RESET_TO_DEFAULT } from './PayloadEditor';

const PayloadEditorWithState = () => {
  const [payload, setPayload] = useState('initial payload');
  return <PayloadEditor payload={payload} setPayload={setPayload} />;
};
const renderWithProvider = () => {
  const store = configureStore();
  render(
    <Provider store={store}>
      <PayloadEditorWithState />
    </Provider>
  );
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

describe('Payload editor', () => {
  it('Should render default payload returned by the endpoint', async () => {
    const payload: TemplateDefaultPayloadResponse = {
      defaultPayload: '{"receiver": "Discord" ,status:"ok"}',
    };
    mockDefaultPayloadResponse(server, payload);
    renderWithProvider();
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      expect(screen.getByTestId('payloadJSON')).toHaveTextContent(payload.defaultPayload);
    });
  });
  it('Should render NO_DEFAULT_TEMPLATE message in case the endpoint is not available ', async () => {
    mockDefaultPayloadResponseRejected(server);
    renderWithProvider();
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      expect(screen.getByTestId('payloadJSON')).toHaveTextContent(NO_DEFAULT_PAYLOAD);
    });
  });
  it('Should render default payload after clicking reset to default button', async () => {
    const payload: TemplateDefaultPayloadResponse = {
      defaultPayload: '{"receiver": "Discord" ,status:"ok"}',
    };
    mockDefaultPayloadResponse(server, payload);
    renderWithProvider();
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
      expect(screen.getByTestId('payloadJSON')).toHaveTextContent(payload.defaultPayload);
    });
    await userEvent.type(screen.getByTestId('payloadJSON'), 'this is the something');
    expect(screen.getByTestId('payloadJSON')).toHaveTextContent('this is the something');
    await userEvent.click(screen.getByText(RESET_TO_DEFAULT));
    await waitFor(() => expect(screen.queryByTestId('payloadJSON')).toHaveTextContent(payload.defaultPayload));
  });
});
