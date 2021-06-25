import React from 'react';
import { Story, Meta } from '@storybook/react';
import { List } from './List';
import { css, cx } from '@emotion/css';
import tinycolor from 'tinycolor2';
import { InlineList } from './InlineList';

export default {
  title: 'Layout/List',
  component: List,
  parameters: {
    controls: {
      exclude: ['renderItem', 'getItemKey', 'className', 'items'],
    },
  },
  args: {
    itemRenderer: 'raw',
    numberOfItems: 3,
  },
  argTypes: {
    itemRenderer: {
      control: {
        type: 'select',
        options: ['raw', 'custom'],
      },
    },
  },
} as Meta;

const generateListItems = (numberOfItems: number) => {
  return [...new Array(numberOfItems)].map((item, i) => {
    return {
      name: `Item-${i}`,
      id: `item-${i}`,
    };
  });
};

const getItem = (inline = false) => {
  const rawRenderer = (item: any) => <>{item.name}</>;
  const customRenderer = (item: any, index: number) => (
    <div
      className={cx([
        css`
          color: white;
          font-weight: bold;
          background: ${tinycolor.fromRatio({ h: index / 26, s: 1, v: 1 }).toHexString()};
          padding: 10px;
        `,
        inline
          ? css`
              margin-right: 20px;
            `
          : css`
              margin-bottom: 20px;
            `,
      ])}
    >
      {item.name}
    </div>
  );

  return {
    rawRenderer,
    customRenderer,
  };
};

export const basic: Story = (args) => {
  const { rawRenderer, customRenderer } = getItem();
  return (
    <List
      items={generateListItems(args.numberOfItems)}
      renderItem={args.itemRenderer === 'raw' ? rawRenderer : customRenderer}
    />
  );
};

export const inline: Story = (args) => {
  const { rawRenderer, customRenderer } = getItem(true);
  return (
    <InlineList
      items={generateListItems(args.numberOfItems)}
      renderItem={args.itemRenderer === 'raw' ? rawRenderer : customRenderer}
    />
  );
};
