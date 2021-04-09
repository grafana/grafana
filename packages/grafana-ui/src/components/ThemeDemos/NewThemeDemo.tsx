import React, { FC, useState } from 'react';
import { css, cx } from '@emotion/css';
import { useTheme } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup } from '../Layout/Layout';
import { GrafanaThemeV2, ThemePaletteColor } from '@grafana/data';
import { CollapsableSection } from '../Collapse/CollapsableSection';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Switch } from '../Switch/Switch';
import { allButtonVariants, Button } from '../Button';

interface DemoBoxProps {
  bg?: string;
  border?: string;
  textColor?: string;
}

const DemoBox: FC<DemoBoxProps> = ({ bg, border, children }) => {
  const style = cx(
    css`
      padding: 16px;
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

export const NewThemeDemo = () => {
  const [radioValue, setRadioValue] = useState('v');
  const [boolValue, setBoolValue] = useState(false);
  const oldTheme = useTheme();
  const t = oldTheme.v2;

  const richColors = [
    t.palette.primary,
    t.palette.secondary,
    t.palette.success,
    t.palette.error,
    t.palette.warning,
    t.palette.info,
  ];

  const radioOptions = [
    { value: 'h', label: 'Horizontal' },
    { value: 'v', label: 'Vertical' },
    { value: 'a', label: 'Auto' },
  ];

  return (
    <div
      className={css`
        width: 100%;
        color: ${t.palette.text.primary};
      `}
    >
      <DemoBox bg={t.palette.layer0}>
        <CollapsableSection label="Layers" isOpen={true}>
          <DemoText>t.palette.layer0</DemoText>
          <DemoBox bg={t.palette.layer1} border={t.palette.border0}>
            <DemoText>t.palette.layer1 is the main & preferred content </DemoText>
            <DemoBox bg={t.palette.layer2} border={t.palette.border0}>
              <DemoText>t.palette.layer2 and t.palette.border.layer1</DemoText>
            </DemoBox>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Text colors" isOpen={true}>
          <HorizontalGroup>
            <DemoBox>
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg={t.palette.layer1}>
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg={t.palette.layer2}>
              <TextColors t={t} />
            </DemoBox>
          </HorizontalGroup>
        </CollapsableSection>
        <CollapsableSection label="Rich colors" isOpen={true}>
          <DemoBox bg={t.palette.layer1}>
            <table className={colorsTableStyle}>
              <thead>
                <tr>
                  <td>name</td>
                  <td>main</td>
                  <td>border & text</td>
                </tr>
              </thead>
              <tbody>
                {richColors.map((color) => (
                  <RichColorDemo key={color.name} color={color} theme={t} />
                ))}
              </tbody>
            </table>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Forms" isOpen={true}>
          <DemoBox bg={t.palette.layer1}>
            <Field label="Input label" description="Field description">
              <Input placeholder="Placeholder" />
            </Field>
            <Field label="Input disabled" disabled>
              <Input placeholder="Placeholder" value="Disabled value" />
            </Field>
            <Field label="Radio label">
              <RadioButtonGroup options={radioOptions} value={radioValue} onChange={setRadioValue} />
            </Field>
            <HorizontalGroup>
              <Field label="Switch">
                <Switch value={boolValue} onChange={(e) => setBoolValue(e.currentTarget.checked)} />
              </Field>
              <Field label="Switch true">
                <Switch value={true} />
              </Field>
              <Field label="Switch false disabled">
                <Switch value={false} disabled />
              </Field>
            </HorizontalGroup>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Shadows" isOpen={true}>
          <DemoBox bg={t.palette.layer1}>
            <HorizontalGroup>
              <ShadowDemo name="Z1" shadow={t.shadows.z1} />
              <ShadowDemo name="Z2" shadow={t.shadows.z2} />
              <ShadowDemo name="Z3" shadow={t.shadows.z3} />
            </HorizontalGroup>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Buttons" isOpen={true}>
          <DemoBox bg={t.palette.layer1}>
            <HorizontalGroup>
              {allButtonVariants.map((variant) => (
                <Button variant={variant} key={variant}>
                  {variant}
                </Button>
              ))}
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </HorizontalGroup>
          </DemoBox>
        </CollapsableSection>
      </DemoBox>
    </div>
  );
};

interface RichColorDemoProps {
  theme: GrafanaThemeV2;
  color: ThemePaletteColor;
}

export function RichColorDemo({ theme, color }: RichColorDemoProps) {
  return (
    <tr>
      <td>{color.name}</td>
      <td>
        <div
          className={css`
            background: ${color.main};
            border-radius: ${theme.shape.borderRadius()};
            color: ${color.contrastText};
            padding: 8px;
            font-weight: 500;
            &:hover {
              background: ${theme.palette.getHoverColor(color.main)};
            }
          `}
        >
          {color.main}
        </div>
      </td>
      <td>
        <div
          className={css`
            border: 1px solid ${color.border};
            color: ${color.text};
            border-radius: 4px;
            padding: 8px;
            &:hover {
              color: ${color.text};
            }
          `}
        >
          {color.text}
        </div>
      </td>
    </tr>
  );
}

const colorsTableStyle = css`
  text-align: center;

  td {
    padding: 8px;
    text-align: center;
  }
`;

export function TextColors({ t }: { t: GrafanaThemeV2 }) {
  return (
    <>
      <DemoText color={t.palette.text.primary}>
        text.primary <Icon name="trash-alt" />
      </DemoText>
      <DemoText color={t.palette.text.secondary}>
        text.secondary <Icon name="trash-alt" />
      </DemoText>
      <DemoText color={t.palette.text.disabled}>
        text.disabled <Icon name="trash-alt" />
      </DemoText>
      <DemoText color={t.palette.primary.text}>
        primary.text <Icon name="trash-alt" />
      </DemoText>
    </>
  );
}

export function ShadowDemo({ name, shadow }: { name: string; shadow: string }) {
  const style = css({
    padding: '16px',
    boxShadow: shadow,
  });
  return <div className={style}>{name}</div>;
}
