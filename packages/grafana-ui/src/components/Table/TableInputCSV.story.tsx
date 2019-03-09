import React from 'react';

import { storiesOf } from '@storybook/react';
import TableInputCSV from './TableInputCSV';
import { action } from '@storybook/addon-actions';
import { TableData } from '../../types/data';

const TableInputStories = storiesOf('UI/Table/Input', module);

TableInputStories.add('default', () => {
  return (
    <div>
      <TableInputCSV
        text="a,b,c\n1,2,3"
        width={'90%'}
        height={'90vh'}
        onTableParsed={(table: TableData, text: string) => {
          console.log('Table', table, text);
          action('Table')(table, text);
        }}
      />
    </div>
  );
});
