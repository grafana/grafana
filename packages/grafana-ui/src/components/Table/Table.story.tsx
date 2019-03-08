import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { Table } from './Table';

import { migratedTestTable, migratedTestStyles, simpleTable } from './examples';
import { ScopedVars } from '../../types/index';

import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { AutoSizer } from 'react-virtualized';

const CenteredStory: FunctionComponent<{}> = ({ children }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
      }}
    >
      <AutoSizer>
        {({ width, height }) => (
          <div
            style={{
              width: `${width}px`,
              height: `${height}px`,
              border: '1px solid red',
            }}
          >
            <div>
              Need to pass {width}/{height} to the table?
            </div>
            {children}
          </div>
        )}
      </AutoSizer>
    </div>
  );
};

const replaceVariables = (value: any, scopedVars: ScopedVars | undefined) => {
  // if (scopedVars) {
  //   // For testing variables replacement in link
  //   _.each(scopedVars, (val, key) => {
  //     value = value.replace('$' + key, val.value);
  //   });
  // }
  return value;
};

storiesOf('UI - Alpha/Table', module)
  .addDecorator(story => <CenteredStory>{story()}</CenteredStory>)
  .add('basic', () => {
    return renderComponentWithTheme(Table, {
      styles: [],
      data: simpleTable,
      replaceVariables,
      showHeader: true,
      width: 500,
      height: 300,
    });
  })
  .add('Test Configuration', () => {
    return renderComponentWithTheme(Table, {
      styles: migratedTestStyles,
      data: migratedTestTable,
      replaceVariables,
      showHeader: true,
      width: 500,
      height: 300,
    });
  });
