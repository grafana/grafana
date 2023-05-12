import { css } from '@emotion/css';
import { Meta } from '@storybook/react';
import React, { ChangeEvent, useState } from 'react';

import { toIconName, IconName } from '@grafana/data';
import { Input, Field, Icon } from '@grafana/ui';

import { useTheme2 } from '../../themes';
import { getAvailableIcons } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './Icon.mdx';

const meta: Meta<typeof Icon> = {
  title: 'Docs overview/Icon',
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

const IconWrapper = ({ name }: { name: IconName }) => {
  const theme = useTheme2();
  const borderColor = theme.colors.border.medium;

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
          font-family: ${theme.typography.fontFamilyMonospace};
          font-size: ${theme.typography.size.xs};
        `}
      >
        {name}
      </div>
    </div>
  );
};

const icons = [...getAvailableIcons()];
icons.sort((a, b) => a.localeCompare(b));

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
        height: 100%;
        overflow: auto;
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
          .filter((val) => val.includes(filter))
          .map((i) => {
            return <IconWrapper name={toIconName(i)!} key={i} />;
          })}
      </div>
    </div>
  );
};

export default meta;
