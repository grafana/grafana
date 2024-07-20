import { ActionModel, Field, LinkModel } from '@grafana/data';

export const getDataLinks = (field: Field, rowIdx: number) => {
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  if ((field.config.links?.length ?? 0) > 0 && field.getLinks != null) {
    const v = field.values[rowIdx];
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };
    field.getLinks({ calculatedValue: disp, valueRowIndex: rowIdx }).forEach((link) => {
      const key = `${link.title}/${link.href}`;
      if (!linkLookup.has(key)) {
        links.push(link);
        linkLookup.add(key);
      }
    });
  }

  return links;
};

export const getActions = (field: Field, rowIdx: number) => {
  const actions: Array<ActionModel<Field>> = [];
  const lookup = new Set<string>();

  if ((field.config.actions?.length ?? 0) > 0) {
    // const v = field.values[rowIdx];

    field.config.actions?.forEach((action) => {
      const key = `${action.title}`;

      if (!lookup.has(key)) {
        actions.push({
          title: action.title,
          // TODO: generate fetch() call using configured & interpolated form fields, href, etc.
          onClick: () => {},
          origin: field,
        });

        lookup.add(key);
      }
    });
  }

  return actions;
};
