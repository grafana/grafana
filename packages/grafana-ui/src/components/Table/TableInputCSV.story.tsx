import React from 'react';

import { storiesOf } from '@storybook/react';
import TableInputCSV from './TableInputCSV';
import { action } from '@storybook/addon-actions';
import { ParseResults } from '../../utils/processTableData';

const TableInputStories = storiesOf('UI/Table/Input', module);

TableInputStories.add('default', () => {
  return (
    <div>
      <TableInputCSV
        width={'90%'}
        height={'90vh'}
        onTableParsed={(results: ParseResults) => {
          console.log('Table Results', results);
          action('Parsed')(results);
        }}
      />
    </div>
  );
});
