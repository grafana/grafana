import { useState } from 'react';
import { type Props } from 'react-virtualized-auto-sizer';
import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

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

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 300,
      scaledHeight: 300,
      scaledWidth: 400,
      width: 400,
    });
});

setupMswServer();

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

describe('Payload editor', () => {
  it('keeps payload edits local until the editor loses focus', async () => {
    const setPayload = jest.fn();
    const { user } = render(
      <PayloadEditor
        payload={DEFAULT_PAYLOAD}
        setPayload={setPayload}
        defaultPayload={DEFAULT_PAYLOAD}
        setPayloadFormatError={jest.fn()}
        payloadFormatError={null}
      />
    );
    const editor = await screen.findByRole('textbox', { name: 'Payload' });
    expect(editor).toHaveTextContent('"instance": "instance1"');
    expect(editor.closest('.cm-editor')).toHaveStyle({ height: '300px' });

    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('[{"labels":{"instance":"edited"}}]');
    expect(editor).toHaveTextContent('[{"labels":{"instance":"edited"}}]');
    expect(setPayload).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Edit payload' }));
    expect(setPayload).toHaveBeenCalledTimes(1);
    expect(setPayload).toHaveBeenLastCalledWith('[{"labels":{"instance":"edited"}}]');
  });

  it('Should render default payload after clicking reset to default button', async () => {
    const { user } = render(<PayloadEditorWithState />);
    const editor = await screen.findByRole('textbox', { name: 'Payload' });
    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('[{"labels":{"instance":"edited"}}]');
    expect(editor).toHaveTextContent('"edited"');

    // click edit payload > reset to defaults
    await user.click(screen.getByRole('button', { name: 'Edit payload' }));
    await user.click(screen.getByRole('menuitem', { name: RESET_TO_DEFAULT }));
    await waitFor(() => expect(editor).toHaveTextContent('"instance": "instance1"'));
    expect(editor).not.toHaveTextContent('"edited"');
  });

  it('displays a generated payload replacement after local edits', async () => {
    const setPayload = jest.fn();
    const props = {
      payload: DEFAULT_PAYLOAD,
      setPayload,
      defaultPayload: DEFAULT_PAYLOAD,
      setPayloadFormatError: jest.fn(),
      payloadFormatError: null,
    };
    const { user, rerender } = render(<PayloadEditor {...props} />);
    const editor = await screen.findByRole('textbox', { name: 'Payload' });
    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('[]');

    rerender(<PayloadEditor {...props} payload={'[{"labels":{"instance":"generated"}}]'} />);
    await waitFor(() => expect(editor).toHaveTextContent('[{"labels":{"instance":"generated"}}]'));

    await user.click(screen.getByRole('button', { name: 'Edit payload' }));
    expect(setPayload).toHaveBeenLastCalledWith('[{"labels":{"instance":"generated"}}]');
  });
});
