import React, { ChangeEvent, useState } from 'react';
import { css } from 'emotion';

import { Input, Field, Icon } from '@grafana/ui';
import { getAvailableIcons, IconName } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme, selectThemeVariant } from '../../themes';
import mdx from './Icon.mdx';

export default {
  title: 'Docs Overview/Icon',
  component: Icon,
  decorators: [withCenteredStory],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {
      page: mdx,
    },
  },
};

const IconWrapper: React.FC<{ name: IconName }> = ({ name }) => {
  const theme = useTheme();
  const borderColor = selectThemeVariant(
    {
      light: theme.palette.gray5,
      dark: theme.palette.dark6,
    },
    theme.type
  );

  return (
    <div
      className={css`
        width: 150px;
        padding: 12px;
        border: 1px solid ${borderColor};
        text-align: center;

        &:hover {
          background: ${borderColor};
        }
      `}
    >
      <Icon name={name} />
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

const icons = getAvailableIcons().sort((a, b) => a.localeCompare(b));

export const IconsOverview = () => {
  const [filter, setFilter] = useState('');

  const searchIcon = (event: ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value);
  };

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        width: 100%;
      `}
    >
      <Field
        className={css`
          width: 300px;
        `}
      >
        <Input onChange={searchIcon} placeholder="Search icons by name" />
      </Field>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
        `}
      >
        {icons
          .filter(val => val.includes(filter))
          .map(i => {
            return <IconWrapper name={i} key={i} />;
          })}
      </div>
    </div>
  );
};
