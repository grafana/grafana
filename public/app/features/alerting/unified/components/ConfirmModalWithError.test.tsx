import { act, useState } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import { useConfirmModalWithError } from './ConfirmModalWithError';

interface DeferredPromise {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

function createDeferredPromise(): DeferredPromise {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

interface TestProps {
  onConfirm: () => Promise<unknown>;
}

function TriggerButton({ onConfirm }: TestProps) {
  const [showConfirmModal, isPending] = useConfirmModalWithError({
    title: 'Test modal',
    body: <p>Modal body</p>,
    onConfirm,
  });

  return (
    <button type="button" disabled={isPending} onClick={showConfirmModal}>
      Open modal
    </button>
  );
}

function TestComponent({ onConfirm }: TestProps) {
  const [isTriggerMounted, setIsTriggerMounted] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setIsTriggerMounted(false)}>
        Unmount trigger
      </button>
      {isTriggerMounted && <TriggerButton onConfirm={onConfirm} />}
    </>
  );
}

const renderTestComponent = (onConfirm: () => Promise<unknown>) =>
  render(<TestComponent onConfirm={onConfirm} />, { withModalRoot: true });

function UnrelatedModal() {
  return <div>Unrelated modal</div>;
}

const showUnrelatedModal = () =>
  act(() => appEvents.publish(new ShowModalReactEvent({ component: UnrelatedModal, props: {} })));

describe('useConfirmModalWithError', () => {
  it('opens the confirmation modal from the trigger', async () => {
    const { user } = renderTestComponent(jest.fn().mockResolvedValue(undefined));

    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const dialog = await screen.findByRole('dialog', { name: 'Test modal' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('closes the modal after a successful confirmation', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const { user } = renderTestComponent(onConfirm);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Test modal' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open modal' })).toBeEnabled();
  });

  it('disables the trigger and the modal actions while the confirmation is in flight', async () => {
    const { promise, resolve } = createDeferredPromise();
    const { user } = renderTestComponent(() => promise);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open modal' })).toBeDisabled();
    expect(screen.getByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();

    resolve();

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Test modal' })).not.toBeInTheDocument());
  });

  it('shows the error modal when the confirmation fails, and forgets it on reopen', async () => {
    const { promise, reject } = createDeferredPromise();
    const { user } = renderTestComponent(() => promise);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    reject(new Error('delete failed'));

    expect(await screen.findByRole('dialog', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText(/delete failed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Something went wrong' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
  });

  it('reopens after another modal has taken over the modal root', async () => {
    const { user } = renderTestComponent(jest.fn().mockResolvedValue(undefined));

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();

    showUnrelatedModal();
    expect(await screen.findByText('Unrelated modal')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Test modal' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
  });

  it('reopens after a route change has cleared the modal root', async () => {
    const { user } = renderTestComponent(jest.fn().mockResolvedValue(undefined));

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();

    act(() => locationService.push('/some-other-page'));
    expect(screen.queryByRole('dialog', { name: 'Test modal' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
  });

  it('drops a failure that lands after another modal has taken over the modal root', async () => {
    const { promise, reject } = createDeferredPromise();
    const { user } = renderTestComponent(() => promise);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    showUnrelatedModal();
    reject(new Error('delete failed'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open modal' })).toBeEnabled());
    expect(screen.getByText('Unrelated modal')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Something went wrong' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
  });

  it('leaves a modal owned by something else alone when the calling component unmounts', async () => {
    const { user } = renderTestComponent(jest.fn().mockResolvedValue(undefined));

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();

    showUnrelatedModal();
    expect(await screen.findByText('Unrelated modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unmount trigger' }));

    expect(screen.getByText('Unrelated modal')).toBeInTheDocument();
  });

  it('hides the modal when the calling component unmounts', async () => {
    const { user } = renderTestComponent(jest.fn().mockResolvedValue(undefined));

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(await screen.findByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unmount trigger' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Test modal' })).not.toBeInTheDocument());
  });
});
