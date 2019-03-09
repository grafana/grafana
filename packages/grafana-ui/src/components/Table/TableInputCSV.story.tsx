import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import TableInputCSV from './TableInputCSV';

const TableInputStories = storiesOf('UI/Table/Input', module);

TableInputStories.addDecorator(withCenteredStory);

TableInputStories.add('default', () => {
  return renderComponentWithTheme(TableInputCSV, {});
});
