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

export function generateThousandsOfOptions(count = 10000): Array<SelectableValue<string>> {
  return new Array(count).fill(null).map((_, index) => ({
    value: makeString(50),
    label: makeString(50),
  }));
}

function makeString(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;

  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }

  return result;
}
