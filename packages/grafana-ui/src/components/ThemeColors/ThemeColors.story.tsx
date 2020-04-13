import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup } from '../Layout/Layout';

export default {
  title: 'General/ThemeColors',
  component: () => {},
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

interface DemoBoxProps {
  bg: string;
  border?: string;
  textColor?: string;
}

const DemoBox: FC<DemoBoxProps> = ({ bg, border, children }) => {
  const style = cx(
    css`
      padding: 16px 32px;
      background: ${bg};
      width: 100%;
    `,
    border
      ? css`
          border: 1px solid ${border};
        `
      : null
  );

  return (
    <div className={style}>
      <div
        className={css`
          padding-bottom: 16px;
        `}
      >
        {name}
      </div>
      {children}
    </div>
  );
};

const DemoText: FC<{ color?: string }> = ({ color, children }) => {
  const style = css`
    padding: 4px;
    color: ${color ?? 'inherit'};
  `;

  return <div className={style}>{children}</div>;
};

export const BackgroundsAndBorders = () => {
  const theme = useTheme();

  return (
    <DemoBox bg={theme.colors.dashboardBg}>
      <DemoText>theme.colors.dashboardBg</DemoText>
      <DemoBox bg={theme.colors.bg1} border={theme.colors.border1}>
        <DemoText>theme.colors.bg1 is the main & preferred content background for text and elements</DemoText>
        <DemoBox bg={theme.colors.bg2} border={theme.colors.border2}>
          <DemoText>
            colors.bg2 background used for elements placed on colors.bg1. Using colors.border1 should be used on
            elements placed ontop of bg1
          </DemoText>
          <DemoBox bg={theme.colors.bg3} border={theme.colors.border2}>
            <DemoText>
              colors.bg3 background used for elements placed on colors.bg2 with colors.border2 used for elements placed
              on bg2
            </DemoText>
          </DemoBox>
        </DemoBox>
      </DemoBox>
    </DemoBox>
  );
};

export const TextColors = () => {
  const theme = useTheme();

  return (
    <HorizontalGroup>
      <DemoBox bg={theme.colors.bodyBg}>
        <>
          Text on main body background (bg1)
          <DemoText color={theme.colors.textHeading}>
            textHeading <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.text}>
            text <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.textWeak}>
            textWeak <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.textFaint}>
            textFaint <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.textEmphasis}>
            textEmphasis <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.textStrong}>
            textStrong <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.formInputText}>
            formInputText <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.formLabel}>
            formLabel <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.formDescription}>
            formDescription <Icon name="trash-alt" />
          </DemoText>
          <DemoText color={theme.colors.textBlue}>textBlue</DemoText>
          <DemoText color={theme.colors.link}>link</DemoText>
          <DemoText color={theme.colors.linkHover}>linkHover</DemoText>
          <DemoText color={theme.colors.linkDisabled}>linkDisabled</DemoText>
          <DemoText color={theme.colors.linkExternal}>linkExternal</DemoText>
        </>
      </DemoBox>
      <DemoBox bg={theme.colors.formInputBg}>
        This is inside form input bg (same as dashboard bg)
        <DemoText color={theme.colors.formInputText}>formInputText</DemoText>
        <DemoText color={theme.colors.formInputTextStrong}>formInputTextStrong</DemoText>
        <DemoText color={theme.colors.formInputDisabledText}>formInputDisabledText</DemoText>
        <DemoText color={theme.colors.formInputPlaceholderText}>formInputPlaceholderText</DemoText>
      </DemoBox>
      <DemoBox bg={theme.colors.bg2}>
        Inside bg2
        <DemoText color={theme.colors.text}>
          text <Icon name="trash-alt" />
        </DemoText>
        <DemoText color={theme.colors.textWeak}>
          textWeak <Icon name="trash-alt" />
        </DemoText>
        <DemoText color={theme.colors.textFaint}>
          textFaint <Icon name="trash-alt" />
        </DemoText>
        <DemoText color={theme.colors.textEmphasis}>
          textEmphasis <Icon name="trash-alt" />
        </DemoText>
        <DemoText color={theme.colors.textStrong}>
          textStrong <Icon name="trash-alt" />
        </DemoText>
      </DemoBox>
    </HorizontalGroup>
  );
};
