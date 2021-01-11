import { Field, LinkModel } from '@grafana/data';
import { css } from 'emotion';
import React from 'react';
import { Tag } from '..';
import { useStyles } from '../../themes';

type FieldLinkProps = {
  link: LinkModel<Field>;
};

export function FieldLink({ link }: FieldLinkProps) {
  const styles = useStyles(getLinkStyles);

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
      <Tag name={link.title} className={styles.tag} colorIndex={6} />
    </a>
  );
}

const getLinkStyles = () => {
  return {
    tag: css`
      margin-left: 6px;
      font-size: 11px;
      padding: 2px 6px;
    `,
  };
};
