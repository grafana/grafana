import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { default as React, useState } from 'react';
import { Provider } from 'react-redux';
import { AutoSizerProps } from 'react-virtualized-auto-sizer';

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

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: function CodeEditor({ value, onBlur }: { value: string; onBlur: (newValue: string) => void }) {
    return <input data-testid="mockeditor" value={value} onChange={(e) => onBlur(e.currentTarget.value)} />;
  },
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: AutoSizerProps) => children({ height: 1, width: 1 });
});

const PayloadEditorWithState = () => {
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  return (
    <PayloadEditor
      payload={payload}
      setPayload={setPayload}
      defaultPayload={DEFAULT_PAYLOAD}
      setPayloadFormatError={jest.fn()}
      payloadFormatError={null}
      onPayloadError={jest.fn()}
    />
  );
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
      expect(screen.getByTestId('mockeditor')).toHaveValue(
        `[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]`
      );
    });
  });

  it('Should render default payload after clicking reset to default button', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('mockeditor')).toHaveValue(
        '[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]'
      );
    });
    await userEvent.type(screen.getByTestId('mockeditor'), 'this is the something');
    expect(screen.getByTestId('mockeditor')).toHaveValue(
      '[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]this is the something'
    );
    await userEvent.click(screen.getByText(RESET_TO_DEFAULT));
    await waitFor(() =>
      expect(screen.queryByTestId('mockeditor')).toHaveValue(
        '[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]'
      )
    );
  });
});
