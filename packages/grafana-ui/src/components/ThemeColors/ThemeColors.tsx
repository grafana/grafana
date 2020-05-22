import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup } from '../Layout/Layout';

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

const DemoText: FC<{ color?: string; bold?: boolean; size?: number }> = ({ color, bold, size, children }) => {
  const style = css`
    padding: 4px;
    color: ${color ?? 'inherit'};
    font-weight: ${bold ? 500 : 400};
    font-size: ${size ?? 14}px;
  `;

  return <div className={style}>{children}</div>;
};

export const ThemeColors = () => {
  const theme = useTheme();

  return (
    <div
      className={css`
        width: 100%;
      `}
    >
      <DemoBox bg={theme.colors.dashboardBg}>
        <DemoText>theme.colors.dashboardBg</DemoText>
        <DemoBox bg={theme.colors.bg1} border={theme.colors.border1}>
          <DemoText>
            theme.colors.bg1 is the main & preferred content background for text and elements This box is using border1
          </DemoText>
          <DemoBox bg={theme.colors.bg2} border={theme.colors.border2}>
            <DemoText>
              colors.bg2 background used for elements placed on colors.bg1. Using colors.border1 should be used on
              elements placed ontop of bg1. Ths box is using border2.
            </DemoText>
            <DemoBox bg={theme.colors.bg3} border={theme.colors.border2}>
              <DemoText>colors.bg3 background used for elements placed on colors.bg2.</DemoText>
            </DemoBox>
          </DemoBox>
        </DemoBox>
      </DemoBox>

      <HorizontalGroup>
        <DemoBox bg={theme.colors.bodyBg}>
          <>
            Text on main body background (bg1)
            <DemoText color={theme.colors.textHeading} size={24}>
              textHeading Usually a bit bigger text <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.text}>
              text <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.textSemiWeak}>
              textSemiWeak <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.textWeak}>
              textWeak <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.textFaint}>
              textFaint <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.textStrong}>
              textStrong <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.formInputText}>
              formInputText <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.formLabel} bold>
              formLabel is also bold <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.formDescription}>
              formDescription <Icon name="trash-alt" />
            </DemoText>
            <DemoText color={theme.colors.textBlue} bold>
              textBlue usually bold
            </DemoText>
            <DemoText color={theme.colors.link}>link</DemoText>
            <DemoText color={theme.colors.linkHover}>linkHover</DemoText>
            <DemoText color={theme.colors.linkDisabled}>linkDisabled</DemoText>
            <DemoText color={theme.colors.linkExternal}>linkExternal</DemoText>
          </>
        </DemoBox>
        <DemoBox bg={theme.colors.formInputBg}>
          This is inside form input bg (same as dashboard bg)
          <DemoText color={theme.colors.formInputText}>formInputText</DemoText>
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
          <DemoText color={theme.colors.textStrong}>
            textStrong <Icon name="trash-alt" />
          </DemoText>
        </DemoBox>
      </HorizontalGroup>
    </div>
  );
};
