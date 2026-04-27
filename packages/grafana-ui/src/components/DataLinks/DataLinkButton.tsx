import { type Field } from '@grafana/data/dataframe';
import type { LinkModel } from '@grafana/data/types';

import { type ButtonProps, Button } from '../Button/Button';

type DataLinkButtonProps = {
  link: LinkModel<Field>;
  buttonProps?: Omit<ButtonProps, 'children'>;
};

/**
 * @internal
 */
export function DataLinkButton({ link, buttonProps }: DataLinkButtonProps) {
  return (
    <a
      href={link.href}
      target={link.target}
      rel="noreferrer"
      onClick={
        link.onClick
          ? (event) => {
              if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link.onClick) {
                event.preventDefault();
                link.onClick(event);
              }
            }
          : undefined
      }
    >
      <Button
        icon={link.target === '_blank' ? 'external-link-alt' : 'link'}
        variant="primary"
        size="sm"
        {...buttonProps}
      >
        {link.title}
      </Button>
    </a>
  );
}
