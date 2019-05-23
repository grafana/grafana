import React from 'react';

import { readCSV } from '../../utils/csv';
import { Table, Props } from './Table';
import { getTheme } from '../../themes/index';
import { GrafanaThemeType } from '../../types/theme';
import renderer from 'react-test-renderer';

const series = readCSV('a,b,c\n1,2,3\n4,5,6')[0];
const setup = (propOverrides?: object) => {
  const props: Props = {
    data: series,

    minColumnWidth: 100,
    showHeader: true,
    fixedHeader: true,
    fixedColumns: 0,
    rotate: false,
    styles: [],
    replaceVariables: (value: string) => value,
    width: 600,
    height: 800,

    theme: getTheme(GrafanaThemeType.Dark),
  }; // partial

  Object.assign(props, propOverrides);

  const tree = renderer.create(<Table {...props} />);
  const instance = (tree.getInstance() as unknown) as Table;

  return {
    tree,
    instance,
  };
};

describe('Table', () => {
  it('ignore invalid properties', () => {
    const { tree, instance } = setup();
    expect(tree.toJSON() + '').toEqual(
      setup({
        id: 3, // Don't pass invalid parameters to MultiGrid
      }).tree.toJSON() + ''
    );
    expect(instance.measurer.has(0, 0)).toBeTruthy();
  });
});
