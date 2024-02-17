import { Field, LinkModel } from '@grafana/data';

export const getDataLinks = (field: Field, datapointIdx: number) => {
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  if (field.getLinks) {
    const v = field.values[datapointIdx];
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };
    field.getLinks({ calculatedValue: disp, valueRowIndex: datapointIdx }).forEach((link) => {
      const key = `${link.title}/${link.href}`;
      if (!linkLookup.has(key)) {
        links.push(link);
        linkLookup.add(key);
      }
    });
  }

  return links;
};
