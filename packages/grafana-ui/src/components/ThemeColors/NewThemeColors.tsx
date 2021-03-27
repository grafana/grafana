import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup } from '../Layout/Layout';
import { createTheme } from '@grafana/data';

interface DemoBoxProps {
  bg: string;
  border?: string;
  textColor?: string;
}

const DemoBox: FC<DemoBoxProps> = ({ bg, border, children }) => {
  const style = cx(
    css`
      padding: 32px 32px 16px 32px;
      background: ${bg};
      width: 100%;
    `,
    border
      ? css`
          border: 1px solid ${border};
        `
      : null
  );

  return <div className={style}>{children}</div>;
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

export const NewThemeColors = () => {
  const oldTheme = useTheme();
  const theme = createTheme({
    palette: {
      mode: oldTheme.type,
    },
  });

  return (
    <div
      className={css`
        width: 100%;
        color: ${theme.palette.text.primary};
      `}
    >
      <DemoBox bg={theme.palette.background.layer0}>
        <DemoText>theme.palette.background.layer0</DemoText>
        <DemoBox bg={theme.palette.background.layer1} border={theme.palette.border.layer0}>
          <DemoText>
            theme.palette.background.layer1 is the main & preferred content background for text and elements This box is
            using border.layer0
          </DemoText>
          <DemoBox bg={theme.palette.background.layer2} border={theme.palette.border.layer1}>
            <DemoText>
              palette.background.layer2 background used for elements placed on palette.background.layer1. Using
              colors.border.layer1 should be used on elements placed ontop of palette.background.layer2. This box is
              using palette.border.layer2.
            </DemoText>
          </DemoBox>
        </DemoBox>
      </DemoBox>

      {/* <HorizontalGroup>
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
      </HorizontalGroup> */}
    </div>
  );
};
