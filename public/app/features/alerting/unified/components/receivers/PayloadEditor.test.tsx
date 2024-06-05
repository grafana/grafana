import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Props } from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';

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
  return ({ children }: Props) =>
    children({
      height: 1,
      scaledHeight: 1,
      scaledWidth: 1,
      width: 1,
    });
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
    />
  );
};
const renderWithProvider = () => {
  render(<PayloadEditorWithState />, { wrapper: TestProvider });
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

    // click edit payload > reset to defaults
    await userEvent.click(screen.getByRole('button', { name: 'Edit payload' }));
    await userEvent.click(screen.getByRole('menuitem', { name: RESET_TO_DEFAULT }));
    await waitFor(() =>
      expect(screen.queryByTestId('mockeditor')).toHaveValue(
        '[  {    "annotations": {      "summary": "Instance instance1 has been down for more than 5 minutes"    },    "labels": {      "instance": "instance1"    },    "startsAt": "2023-04-25T15:28:56.440Z"  }]'
      )
    );
  });
});
