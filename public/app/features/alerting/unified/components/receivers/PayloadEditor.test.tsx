import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { default as React, useState } from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import 'whatwg-fetch';

import { PayloadEditor, RESET_TO_DEFAULT } from './PayloadEditor';
import { DEFAULT_PAYLOAD } from './TemplateForm';

const PayloadEditorWithState = () => {
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  return <PayloadEditor payload={payload} setPayload={setPayload} defaultPayload={DEFAULT_PAYLOAD} />;
};
const renderWithProvider = () => {
  const store = configureStore();
  render(
    <Provider store={store}>
      <PayloadEditorWithState />
    </Provider>
  );
};

describe('Payload editor', () => {
  it('Should render default payload by default', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('payloadJSON')).toHaveTextContent(
        '{ "alerts": [{ "annotations": { "summary": "Instance instance1 has been down for more than 5 minutes" }, "labels": { "instance": "instance1" }, "startsAt": "2023-04-01T00:00:00Z", "endsAt": "2023-04-01T00:05:00Z" }] }'
      );
    });
  });

  it('Should render default payload after clicking reset to default button', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('payloadJSON')).toHaveTextContent(
        '{ "alerts": [{ "annotations": { "summary": "Instance instance1 has been down for more than 5 minutes" }, "labels": { "instance": "instance1" }, "startsAt": "2023-04-01T00:00:00Z", "endsAt": "2023-04-01T00:05:00Z" }] }'
      );
    });
    await userEvent.type(screen.getByTestId('payloadJSON'), 'this is the something');
    expect(screen.getByTestId('payloadJSON')).toHaveTextContent('this is the something');
    await userEvent.click(screen.getByText(RESET_TO_DEFAULT));
    await waitFor(() =>
      expect(screen.queryByTestId('payloadJSON')).toHaveTextContent(
        '{ "alerts": [{ "annotations": { "summary": "Instance instance1 has been down for more than 5 minutes" }, "labels": { "instance": "instance1" }, "startsAt": "2023-04-01T00:00:00Z", "endsAt": "2023-04-01T00:05:00Z" }] }'
      )
    );
  });
});
