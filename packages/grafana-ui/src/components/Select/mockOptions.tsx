import { SelectableValue } from '@grafana/data';
import { kebabCase } from 'lodash';

export const generateOptions = (desc = false, inputValue?: string | null, groupedOptions?: boolean) => {
  const groups = ['Team Asia', 'Team Europe', 'Team North America', 'Team South America', 'Team Africa'];
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

  let vals = [];
  const getOptionsChunk = (chunkNumber: number, chunkSize = 4): Array<SelectableValue<string>> => {
    // console.log(chunkNumber, chunkSize, chunkNumber * chunkSize, chunkNumber * chunkSize + chunkSize - 1);
    return values
      .slice(chunkNumber * chunkSize, chunkNumber * chunkSize + chunkSize)
      .map(v => ({ value: kebabCase(v), label: v }));
  };
  if (groupedOptions) {
    console.log(groupedOptions);
    vals = groups.map((g, index) => {
      return {
        label: g,
        options: getOptionsChunk(index),
      };
    });

    return vals;
  } else {
    vals = values.map<SelectableValue<string>>(name => ({
      value: kebabCase(name),
      label: name,
      description: desc ? `This is a description of ${name}` : undefined,
    }));
    if (inputValue) {
      return vals.filter(v => v.label?.includes(inputValue));
    }
  }

  return vals;
};
