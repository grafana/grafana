import React from 'react';
import { boolean, text, select } from '@storybook/addon-knobs';
import { Badge, BadgeColor } from './Badge';

export default {
  title: 'Data Display/Badge',
  component: Badge,
  decorators: [],
  parameters: {
    docs: {},
  },
};

export const basic = () => {
  const badgeColor = select<BadgeColor>(
    'Badge color',
    {
      Red: 'red',
      Green: 'green',
      Blue: 'blue',
      Orange: 'orange',
    },
    'blue'
  );
  const withIcon = boolean('With icon', true);
  const tooltipText = text('Tooltip text', '');
  return (
    <Badge
      text={'Badge label'}
      color={badgeColor}
      icon={withIcon ? 'rocket' : undefined}
      tooltip={tooltipText.trim() === '' ? undefined : tooltipText}
    />
  );
};
