import React from 'react';
import { css } from 'emotion';

import { Icon } from './Icon';
import { getAvailableIcons, IconType } from './types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme, selectThemeVariant } from '../../themes';
import mdx from './Icon.mdx';

export default {
  title: 'General/Icon',
  component: Icon,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const IconWrapper: React.FC<{ name: IconType }> = ({ name }) => {
  const theme = useTheme();
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray5,
      dark: theme.colors.dark6,
    },
    theme.type
  );

  return (
    <div
      className={css`
        width: 150px;
        height: 60px;
        display: table-cell;
        padding: 12px;
        border: 1px solid ${borderColor};
        text-align: center;

        &:hover {
          background: ${borderColor};
        }
      `}
    >
      <Icon
        name={name}
        className={css`
          font-size: 18px;
        `}
      />
      <div
        className={css`
          padding-top: 16px;
          word-break: break-all;
          font-family: ${theme.typography.fontFamily.monospace};
          font-size: ${theme.typography.size.xs};
        `}
      >
        {name}
      </div>
    </div>
  );
};

export const simple = () => {
  const icons = getAvailableIcons();
  const iconsPerRow = 10;
  const rows: IconType[][] = [[]];
  let rowIdx = 0;

  icons.forEach((i: IconType, idx: number) => {
    if (idx % iconsPerRow === 0) {
      rows.push([]);
      rowIdx++;
    }
    rows[rowIdx].push(i);
  });

  return (
    <div
      className={css`
        display: table;
        table-layout: fixed;
        border-collapse: collapse;
      `}
    >
      {rows.map(r => {
        return (
          <div
            className={css`
              display: table-row;
            `}
          >
            {r.map((i, index) => {
              return <IconWrapper name={i} />;
            })}
          </div>
        );
      })}
    </div>
  );
};
