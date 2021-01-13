import { Field, LinkModel } from '@grafana/data';
import React from 'react';
import { Button } from '..';

type FieldLinkProps = {
  link: LinkModel<Field>;
};

export function FieldLink({ link }: FieldLinkProps) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      onClick={
        link.onClick
          ? event => {
              if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link.onClick) {
                event.preventDefault();
                link.onClick(event);
              }
            }
          : undefined
      }
    >
      <Button icon="external-link-alt">{link.title}</Button>
    </a>
  );
}
