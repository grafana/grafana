import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';
import { createTheme, GrafanaThemeV2 } from '@grafana/data';
import { CollapsableSection } from '../Collapse/CollapsableSection';

interface DemoBoxProps {
  bg?: string;
  border?: string;
  textColor?: string;
}

const DemoBox: FC<DemoBoxProps> = ({ bg, border, children }) => {
  const style = cx(
    css`
      padding: 32px 32px 16px 32px;
      background: ${bg ?? 'inherit'};
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
  const t = createTheme({
    palette: {
      mode: oldTheme.type,
    },
  });

  return (
    <div
      className={css`
        width: 100%;
        color: ${t.palette.text.primary};
      `}
    >
      <DemoBox bg={t.palette.background.layer0}>
        <CollapsableSection label="Layers" isOpen={true}>
          <DemoText>t.palette.background.layer0</DemoText>
          <DemoBox bg={t.palette.background.layer1} border={t.palette.border.layer0}>
            <DemoText>t.palette.background.layer1 is the main & preferred content background.</DemoText>
            <DemoBox bg={t.palette.background.layer2} border={t.palette.border.layer1}>
              <DemoText>t.palette.background.layer2 and t.palette.border.layer1</DemoText>
            </DemoBox>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Text colors" isOpen={true}>
          <HorizontalGroup>
            <DemoBox>
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg={t.palette.background.layer1}>
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg={t.palette.background.layer2}>
              <TextColors t={t} />
            </DemoBox>
          </HorizontalGroup>
        </CollapsableSection>
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

export function TextColors({ t }: { t: GrafanaThemeV2 }) {
  return (
    <>
      <DemoText color={t.palette.text.primary}>text.primary</DemoText>
      <DemoText color={t.palette.text.secondary}>text.secondary</DemoText>
      <DemoText color={t.palette.text.disabled}>text.disabled</DemoText>
    </>
  );
}
