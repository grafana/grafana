import React from 'react';

import { Icon } from './Icon';
import { getAvailableIcons, IconType } from './types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme } from '../../themes';

export default {
  title: 'UI/Icon',
  component: Icon,
  decorators: [withCenteredStory],
};

const IconWrapper: React.FC<{ name: IconType }> = ({ name }) => {
  const theme = useTheme();
  return (
    <div
      style={{
        width: '60px',
        height: '60px',
        display: 'table-cell',
        padding: '12px',
        border: `1px solid ${theme.colors.dark6}`,
        textAlign: 'center',
      }}
    >
      <Icon name={name} />
      <div style={{ paddingTop: '16px' }}>
        <code>{name}</code>
      </div>
    </div>
  );
};

export const simple = () => {
  const icons = getAvailableIcons();
  const iconsPerRow = 6;
  const rows: IconType[][] = [[]];
  let rowIdx = 0;

  icons.forEach((i, idx) => {
    if (idx % iconsPerRow === 0) {
      rows.push([]);
      rowIdx++;
    }
    rows[rowIdx].push(i);
  });

  console.log(rows);

  return (
    <div
      style={{
        display: 'table',
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
      }}
    >
      {rows.map(r => {
        return (
          <div style={{ display: 'table-row' }}>
            {r.map((i, index) => {
              return <IconWrapper name={i} />;
            })}
          </div>
        );
      })}
    </div>
  );
};
