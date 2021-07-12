import { Field, LinkModel } from '@grafana/data';
import { MouseEventHandler } from 'react';
import { Row } from 'react-table';

/**
 * @internal
 */
export const getCellLinks = (field: Field, row: Row<any>) => {
  let link: LinkModel<any> | undefined;
  let onClick: MouseEventHandler<HTMLAnchorElement> | undefined;
  if (field.getLinks) {
    link = field.getLinks({
      valueRowIndex: row.index,
    })[0];
  }

  // Handle explicit `onClick` callbacks
  if (link && link.onClick) {
    onClick = (event) => {
      // Allow opening in new tab
      if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link!.onClick) {
        event.preventDefault();
        link!.onClick({
          origin: {
            field,
            row: row.index,
          },
          e: event,
          replaceVariables: (v) => v,
        });
      }
    };
  }
  return {
    link,
    onClick,
  };
};
