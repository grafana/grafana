import { Row } from 'react-table';

import { Field, LinkModel } from '@grafana/data';

/**
 * @internal
 */
export const getCellLinks = (field: Field, row: Row) => {
  let links: Array<LinkModel<Field>> | undefined;
  if (field.getLinks) {
    links = field.getLinks({
      valueRowIndex: row.index,
    });
  }

  if (!links) {
    return;
  }

  for (let i = 0; i < links?.length; i++) {
    if (links[i].onClick) {
      const origOnClick = links[i].onClick;

      links[i].onClick = (event) => {
        // Allow opening in new tab
        if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
          event.preventDefault();
          origOnClick!(event, {
            field,
            rowIndex: row.index,
          });
        }
      };
    }
  }

  return links.filter((link) => link.href || link.onClick != null);
};
