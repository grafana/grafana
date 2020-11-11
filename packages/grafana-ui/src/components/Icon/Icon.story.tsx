import React, { ChangeEvent, useState } from 'react';
import { css } from 'emotion';

import { Input, Field, Icon, Legend } from '@grafana/ui';
import { getAvailableDefaultIcons, getAvailableSolidIcons, IconName, IconType } from '../../types';
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

const IconWrapper: React.FC<{ name: IconName; type: IconType }> = ({ name, type }) => {
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
      {/* @ts-ignore */}
      <Icon name={name} type={type} />
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

const defaultIcons = getAvailableDefaultIcons().sort((a, b) => a.localeCompare(b));
const solidIcons = getAvailableSolidIcons().sort((a, b) => a.localeCompare(b));

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
      <Legend>Default icons</Legend>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 20px;
        `}
      >
        {defaultIcons
          .filter(val => val.includes(filter))
          .map(i => {
            return <IconWrapper name={i} key={i} type={'default'} />;
          })}
      </div>
      <Legend>Solid icons</Legend>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
        `}
      >
        {solidIcons
          .filter(val => val.includes(filter))
          .map(i => {
            return <IconWrapper name={i} key={i} type={'solid'} />;
          })}
      </div>
    </div>
  );
};
