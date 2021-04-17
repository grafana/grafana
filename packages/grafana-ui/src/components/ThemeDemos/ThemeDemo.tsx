import React, { FC, useState } from 'react';
import { css, cx } from '@emotion/css';
import { useTheme } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';
import { GrafanaThemeV2, ThemePaletteColor } from '@grafana/data';
import { CollapsableSection } from '../Collapse/CollapsableSection';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Switch } from '../Switch/Switch';
import { allButtonVariants, Button } from '../Button';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Card } from '../Card/Card';
import { Select } from '../Select/Select';

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

export const ThemeDemo = () => {
  const [radioValue, setRadioValue] = useState('v');
  const [boolValue, setBoolValue] = useState(false);
  const [selectValue, setSelectValue] = useState('Item 2');
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

  const selectOptions = [
    { label: 'Item 1', value: 'Item 1' },
    { label: 'Item 2', value: 'Item 2' },
    { label: 'Item 3', value: 'Item 3' },
    { label: 'Item 4', value: 'Item 4' },
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
      <DemoBox bg={t.palette.background.canvas}>
        <CollapsableSection label="Layers" isOpen={true}>
          <DemoText>t.palette.background.canvas</DemoText>
          <DemoBox bg={t.palette.background.primary} border={t.palette.border.weak}>
            <DemoText>t.palette.background.primary is the main & preferred content </DemoText>
            <DemoBox bg={t.palette.background.secondary} border={t.palette.border.weak}>
              <DemoText>t.palette.background.secondary and t.palette.border.layer1</DemoText>
            </DemoBox>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Text colors" isOpen={true}>
          <HorizontalGroup>
            <DemoBox>
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg={t.palette.background.primary}>
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg={t.palette.background.secondary}>
              <TextColors t={t} />
            </DemoBox>
          </HorizontalGroup>
        </CollapsableSection>
        <CollapsableSection label="Rich colors" isOpen={true}>
          <DemoBox bg={t.palette.background.primary}>
            <table className={colorsTableStyle}>
              <thead>
                <tr>
                  <td>name</td>
                  <td>main</td>
                  <td>shade (used for hover)</td>
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
          <DemoBox bg={t.palette.background.primary}>
            <Field label="Input label" description="Field description">
              <Input placeholder="Placeholder" />
            </Field>
            <Field label="Input disabled" disabled>
              <Input placeholder="Placeholder" value="Disabled value" />
            </Field>
            <Field label="Select">
              <Select options={selectOptions} value={selectValue} onChange={(v) => setSelectValue(v?.value!)} />
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
            <VerticalGroup>
              <div>Inline forms</div>
              <InlineFieldRow>
                <InlineField label="Label">
                  <Input placeholder="Placeholder" />
                </InlineField>
                <InlineField label="Another Label" disabled>
                  <Input placeholder="Disabled" />
                </InlineField>
              </InlineFieldRow>
            </VerticalGroup>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Shadows" isOpen={true}>
          <DemoBox bg={t.palette.background.primary}>
            <HorizontalGroup>
              {Object.keys(t.shadows).map((key) => (
                <ShadowDemo name={key} shadow={(t.shadows as any)[key]} key={key} />
              ))}
            </HorizontalGroup>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Buttons" isOpen={true}>
          <DemoBox bg={t.palette.background.primary}>
            <VerticalGroup spacing="lg">
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
              <Card heading="Button inside card">
                <Card.Actions>
                  <>
                    {allButtonVariants.map((variant) => (
                      <Button variant={variant} key={variant}>
                        {variant}
                      </Button>
                    ))}
                    <Button variant="primary" disabled>
                      Disabled
                    </Button>
                  </>
                </Card.Actions>
              </Card>
            </VerticalGroup>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Actions" isOpen={true}>
          <ActionsDemo />
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
          `}
        >
          {color.main}
        </div>
      </td>
      <td>
        <div
          className={css`
            background: ${color.shade};
            color: ${color.contrastText};
            border-radius: 4px;
            padding: 8px;
          `}
        >
          {color.shade}
        </div>
      </td>
      <td>
        <div
          className={css`
            border: 1px solid ${color.border};
            color: ${color.text};
            border-radius: 4px;
            padding: 8px;
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

export function ActionsDemo() {
  const t = useTheme().v2;

  const item = css({
    padding: '8px',
    ':hover': {
      background: t.palette.action.hover,
    },
  });
  const hover = css({
    background: t.palette.action.hover,
  });
  const selected = css({
    background: t.palette.action.selected,
  });
  const focused = css({
    background: t.palette.action.focus,
  });

  return (
    <HorizontalGroup>
      <DemoBox bg={t.palette.background.canvas}>
        <VerticalGroup>
          <div className={item}>item</div>
          <div className={item}>item</div>
          <div className={cx(item, hover)}>item hover</div>
          <div className={cx(item, selected)}>item selected</div>
          <div className={cx(item, focused)}>item focused</div>
        </VerticalGroup>
      </DemoBox>
      <DemoBox bg={t.palette.background.primary}>
        <VerticalGroup>
          <div className={item}>item</div>
          <div className={item}>item</div>
          <div className={cx(item, hover)}>item hover</div>
          <div className={cx(item, selected)}>item selected</div>
          <div className={cx(item, focused)}>item focused</div>
        </VerticalGroup>
      </DemoBox>
      <DemoBox bg={t.palette.background.secondary}>
        <VerticalGroup>
          <div className={item}>item</div>
          <div className={item}>item</div>
          <div className={cx(item, hover)}>item hover</div>
          <div className={cx(item, selected)}>item selected</div>
          <div className={cx(item, focused)}>item focused</div>
        </VerticalGroup>
      </DemoBox>
    </HorizontalGroup>
  );
}
