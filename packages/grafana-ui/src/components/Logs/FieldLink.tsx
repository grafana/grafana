import { Field, LinkModel } from '@grafana/data';
import React from 'react';
import { ButtonProps, Button } from '../Button';

type FieldLinkProps = {
  link: LinkModel<Field>;
  buttonProps?: ButtonProps;
};

export function FieldLink({ link, buttonProps }: FieldLinkProps) {
  return (
    <a
      href={link.href}
      target="_blank"
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
      <Button icon="external-link-alt" {...buttonProps}>
        {link.title}
      </Button>
    </a>
  );
}
