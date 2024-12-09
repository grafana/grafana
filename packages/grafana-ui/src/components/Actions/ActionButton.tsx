import { ActionModel, Field } from '@grafana/data';

import { Button, ButtonProps } from '../Button';

type ActionButtonProps = ButtonProps & {
  action: ActionModel<Field>;
};

/**
 * @internal
 */
export function ActionButton({ action, ...buttonProps }: ActionButtonProps) {
  return (
    <Button variant="primary" size="sm" onClick={action.onClick} {...buttonProps}>
      {action.title}
    </Button>
  );
}
