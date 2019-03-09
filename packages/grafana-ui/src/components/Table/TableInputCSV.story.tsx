import { storiesOf } from '@storybook/react';
import TableInputCSV from './TableInputCSV';
import { withFullSizeStory } from '../../utils/storybook/withFullSizeStory';

const TableInputStories = storiesOf('UI/Table/Input', module);

TableInputStories.add('default', () => {
  return withFullSizeStory(TableInputCSV, {});
});
