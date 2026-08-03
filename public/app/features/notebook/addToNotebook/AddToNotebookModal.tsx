import { t } from '@grafana/i18n';
import { Modal } from '@grafana/ui';

import { AddToNotebookForm, type AddToNotebookFormProps } from './AddToNotebookForm';

interface Props extends Omit<AddToNotebookFormProps, 'onDismiss'> {
  onDismiss?: () => void;
}

/**
 * Self-contained modal wrapper around AddToNotebookForm, for imperative openers
 * (ShowModalReactEvent from the dashboard panel menu). The modals context provider
 * injects onDismiss.
 */
export function AddToNotebookModal({ onDismiss, ...formProps }: Props) {
  const close = onDismiss ?? (() => {});
  return (
    <Modal title={t('notebooks.add-modal.title', 'Add to notebook')} isOpen onDismiss={close}>
      <AddToNotebookForm {...formProps} onDismiss={close} />
    </Modal>
  );
}
