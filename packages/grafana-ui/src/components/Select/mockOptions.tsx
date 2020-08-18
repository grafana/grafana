import { SelectableValue } from '@grafana/data';
import { kebabCase } from 'lodash';

export const generateOptions = (desc = false, inputValue?: string | null) => {
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
  ];

  const vals = values.map<SelectableValue<string>>(name => ({
    value: kebabCase(name),
    label: name,
    description: desc ? `This is a description of ${name}` : undefined,
  }));
  if (inputValue) {
    return vals.filter(v => v.label?.includes(inputValue));
  }

  return vals;
};
