import { ActionModel, Field } from '@grafana/data';

import { Button, ButtonProps } from '../Button';

type ActionButtonProps = {
  action: ActionModel<Field>;
  buttonProps?: ButtonProps;
};

/**
 * @internal
 */
export function ActionButton({ action, buttonProps }: ActionButtonProps) {
  return (
    <Button variant="primary" size="sm" onClick={action.onClick} {...buttonProps}>
      {action.title}
    </Button>
  );
}
