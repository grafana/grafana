import React from 'react';

export function ConfirmCloneProvRuleModal({
  isOpen,
  onConfirm,
  onDismiss,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Clone provisioned rule"
      body={
        <div>
          <p>
            The new rule will <span className={style.bold}>NOT</span> be marked as a provisioned rule.
          </p>
          <p>
            You will need to set a new alert group for the cloned rule because the original one has been provisioned and
            cannot be used for rules created in the UI.
          </p>
        </div>
      }
      confirmText="Clone"
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
}
