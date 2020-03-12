import React from 'react';

import { storiesOf } from '@storybook/react';
import TableInputCSV from './TableInputCSV';
import { action } from '@storybook/addon-actions';
import { DataFrame } from '@grafana/data';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const TableInputStories = storiesOf('General/Experimental/TableInputCSV', module);

TableInputStories.addDecorator(withCenteredStory);

TableInputStories.add('default', () => {
  return (
    <TableInputCSV
      width={400}
      height={'90vh'}
      text={'a,b,c\n1,2,3'}
      onSeriesParsed={(data: DataFrame[], text: string) => {
        console.log('Data', data, text);
        action('Data')(data, text);
      }}
    />
  );
});
