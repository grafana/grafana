import { UseFieldArrayRemove } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface RemoveButtonProps {
  remove: UseFieldArrayRemove;
  index: number;
}
export function RemoveButton({ remove, index }: RemoveButtonProps) {
  return (
    <Button
      aria-label={t('alerting.remove-button.aria-label-delete-label', 'delete label')}
      icon="trash-alt"
      data-testid={`delete-label-${index}`}
      variant="secondary"
      onClick={() => {
        remove(index);
      }}
    />
  );
}

interface AddButtonProps {
  append: () => void;
}
export function AddButton({ append }: AddButtonProps) {
  return (
    <Button icon="plus" type="button" variant="secondary" onClick={append}>
      <Trans i18nKey="alerting.add-button.add-more">Add more</Trans>
    </Button>
  );
}
