import { type ReactNode } from 'react';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { useConfirmModalWithError } from './ConfirmModalWithError';

interface TestModalProps {
  body: ReactNode;
  onConfirm: () => Promise<unknown>;
}

function TestModal({ body, onConfirm }: TestModalProps) {
  const [modal, showModal, isPending] = useConfirmModalWithError({
    title: 'Test modal',
    body,
    onConfirm,
  });

  return (
    <>
      <button type="button" onClick={showModal} disabled={isPending}>
        Open modal
      </button>
      {modal}
    </>
  );
}

describe('useConfirmModalWithError', () => {
  it('closes after a successful action', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const { user } = render(<TestModal body={<div>Modal body</div>} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Test modal' })).not.toBeInTheDocument());
  });

  it('surfaces errors from promise-returning actions', async () => {
    let rejectConfirm!: (error: Error) => void;
    const onConfirm = jest.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectConfirm = reject;
        })
    );
    const { user } = render(<TestModal body={<div>Modal body</div>} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: 'Open modal' })).toBeDisabled();

    rejectConfirm(new Error('delete failed'));

    expect(await screen.findByRole('dialog', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText(/delete failed/i)).toBeInTheDocument();

    await user.click(screen.getByText('Close'));
    expect(screen.queryByRole('dialog', { name: 'Something went wrong' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
  });
});
