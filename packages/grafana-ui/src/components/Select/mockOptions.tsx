import { kebabCase } from 'lodash';

import { SelectableValue } from '@grafana/data';

export const generateOptions = (desc = false) => {
  const values = [
    'Sharilyn Markowitz',
    'Naomi Striplin',
    'Beau Bevel',
    'Garrett Starkes',
    'Hildegarde Pedro',
    'Gudrun Seyler',
    'Eboni Raines',
    'Hye Felix',
    'Chau Brito',
    'Heidy Zook',
    'Karima Husain',
    'Virgil Mckinny',
    'Kaley Dodrill',
    'Sharan Ruf',
    'Edgar Loveland',
    'Judie Sanger',
    'Season Bundrick',
    'Ok Vicente',
    'Garry Spitz',
    'Han Harnish',
    'A very long value that is very long and takes up a lot of space and should be truncated preferrably if it does not fit',
  ];

  return values.map<SelectableValue<string>>((name) => ({
    value: kebabCase(name),
    label: name,
    description: desc ? `This is a description of ${name}` : undefined,
  }));
};

export const generateThousandsOfOptions = () => {
  const options: Array<SelectableValue<string>> = new Array(10000).fill(null).map((_, index) => ({
    value: String(index),
    label: 'Option ' + index,
    description: 'This is option number ' + index,
  }));

  return options;
};
