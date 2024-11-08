/* eslint-disable @grafana/no-untranslated-strings */
import { css, cx } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2, ThemeRichColor } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { allButtonVariants, Button } from '../Button';
import { Card } from '../Card/Card';
import { CollapsableSection } from '../Collapse/CollapsableSection';
import { Field } from '../Forms/Field';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { BackgroundColor, BorderColor, Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Select } from '../Select/Select';
import { Switch } from '../Switch/Switch';
import { Text, TextProps } from '../Text/Text';

interface DemoBoxProps {
  bg?: BackgroundColor;
  border?: BorderColor;
  textColor?: TextProps['color'];
}

const DemoBox = ({ bg, border, children }: React.PropsWithChildren<DemoBoxProps>) => {
  return (
    <Box backgroundColor={bg ? bg : undefined} padding={2} borderStyle={border ? 'solid' : undefined}>
      {children}
    </Box>
  );
};

const DemoText = ({
  color,
  bold,
  children,
}: React.PropsWithChildren<{ color?: TextProps['color']; bold?: boolean; size?: number }>) => {
  return (
    <Box padding={0.5}>
      {children && (
        <Text color={color ? color : undefined} weight={bold ? 'bold' : undefined}>
          {children}
        </Text>
      )}
    </Box>
  );
};

export const ThemeDemo = () => {
  const [radioValue, setRadioValue] = useState('v');
  const [boolValue, setBoolValue] = useState(false);
  const [selectValue, setSelectValue] = useState('Item 2');
  const t = useTheme2();

  const richColors = [
    t.colors.primary,
    t.colors.secondary,
    t.colors.success,
    t.colors.error,
    t.colors.warning,
    t.colors.info,
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
      className={css({
        width: '100%',
        color: t.colors.text.primary,
      })}
    >
      <DemoBox bg="canvas">
        <CollapsableSection label="Layers" isOpen={true}>
          <DemoText>t.colors.background.canvas</DemoText>
          <DemoBox bg="primary" border="weak">
            <DemoText>t.colors.background.primary is the main & preferred content </DemoText>
            <DemoBox bg="secondary" border="weak">
              <DemoText>t.colors.background.secondary and t.colors.border.layer1</DemoText>
            </DemoBox>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Text colors" isOpen={true}>
          <Stack justifyContent="flex-start">
            <DemoBox>
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg="primary">
              <TextColors t={t} />
            </DemoBox>
            <DemoBox bg="secondary">
              <TextColors t={t} />
            </DemoBox>
          </Stack>
        </CollapsableSection>
        <CollapsableSection label="Rich colors" isOpen={true}>
          <DemoBox bg="primary">
            <table className={colorsTableStyle}>
              <thead>
                <tr>
                  <td>name</td>
                  <td>main</td>
                  <td>shade (used for hover)</td>
                  <td>transparent</td>
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
          <DemoBox bg="primary">
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
            <Stack>
              <Field label="Switch">
                <Switch value={boolValue} onChange={(e) => setBoolValue(e.currentTarget.checked)} />
              </Field>
              <Field label="Switch true">
                <Switch value={true} />
              </Field>
              <Field label="Switch false disabled" disabled={true}>
                <Switch value={false} />
              </Field>
            </Stack>
            <Stack direction="column">
              <div>Inline forms</div>
              <InlineFieldRow>
                <InlineField label="Label">
                  <Input placeholder="Placeholder" />
                </InlineField>
                <InlineField label="Another Label" disabled>
                  <Input placeholder="Disabled" />
                </InlineField>
              </InlineFieldRow>
            </Stack>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Shadows" isOpen={true}>
          <DemoBox bg="primary">
            <Stack>
              {Object.entries(t.shadows).map(([key, value]) => (
                <ShadowDemo name={key} shadow={value} key={key} />
              ))}
            </Stack>
          </DemoBox>
        </CollapsableSection>
        <CollapsableSection label="Buttons" isOpen={true}>
          <DemoBox bg="primary">
            <Stack direction="column" gap={3}>
              <Stack>
                {allButtonVariants.map((variant) => (
                  <Button variant={variant} key={variant}>
                    {variant}
                  </Button>
                ))}
                <Button variant="primary" disabled>
                  Disabled
                </Button>
              </Stack>
              <Card>
                <Card.Heading>Button inside card</Card.Heading>
                <Card.Actions>
                  {allButtonVariants.map((variant) => (
                    <Button variant={variant} key={variant}>
                      {variant}
                    </Button>
                  ))}
                  <Button variant="primary" disabled>
                    Disabled
                  </Button>
                </Card.Actions>
              </Card>
            </Stack>
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
  theme: GrafanaTheme2;
  color: ThemeRichColor;
}

export function RichColorDemo({ theme, color }: RichColorDemoProps) {
  return (
    <tr>
      <td>{color.name}</td>
      <td>
        <div
          className={css({
            background: color.main,
            borderRadius: theme.shape.radius.default,
            color: color.contrastText,
            padding: '8px',
            fontWeight: 500,
          })}
        >
          {color.main}
        </div>
      </td>
      <td>
        <div
          className={css({
            background: color.shade,
            color: color.contrastText,
            borderRadius: theme.shape.radius.default,
            padding: '8px',
          })}
        >
          {color.shade}
        </div>
      </td>
      <td>
        <div
          className={css({
            background: color.transparent,
            borderRadius: theme.shape.radius.default,
            padding: '8px',
          })}
        >
          {color.shade}
        </div>
      </td>
      <td>
        <div
          className={css({
            border: `1px solid ${color.border}`,
            color: color.text,
            borderRadius: theme.shape.radius.default,
            padding: '8px',
          })}
        >
          {color.text}
        </div>
      </td>
    </tr>
  );
}

const colorsTableStyle = css({
  textAlign: 'center',

  td: {
    padding: '8px',
    textAlign: 'center',
  },
});

export function TextColors({ t }: { t: GrafanaTheme2 }) {
  return (
    <>
      <DemoText color="primary">
        text.primary <Icon name="trash-alt" />
      </DemoText>
      <DemoText color="secondary">
        text.secondary <Icon name="trash-alt" />
      </DemoText>
      <DemoText color="disabled">
        text.disabled <Icon name="trash-alt" />
      </DemoText>
      <DemoText color="primary">
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
  const t = useTheme2();

  const item = css({
    padding: '8px',
    ':hover': {
      background: t.colors.action.hover,
    },
  });
  const hover = css({
    background: t.colors.action.hover,
  });
  const selected = css({
    background: t.colors.action.selected,
  });
  const focused = css({
    background: t.colors.action.focus,
  });

  return (
    <Stack justifyContent="flex-start">
      <DemoBox bg="canvas">
        <Stack direction="column">
          <div className={item}>item</div>
          <div className={item}>item</div>
          <div className={cx(item, hover)}>item hover</div>
          <div className={cx(item, selected)}>item selected</div>
          <div className={cx(item, focused)}>item focused</div>
        </Stack>
      </DemoBox>
      <DemoBox bg="primary">
        <Stack direction="column">
          <div className={item}>item</div>
          <div className={item}>item</div>
          <div className={cx(item, hover)}>item hover</div>
          <div className={cx(item, selected)}>item selected</div>
          <div className={cx(item, focused)}>item focused</div>
        </Stack>
      </DemoBox>
      <DemoBox bg="secondary">
        <Stack direction="column">
          <div className={item}>item</div>
          <div className={item}>item</div>
          <div className={cx(item, hover)}>item hover</div>
          <div className={cx(item, selected)}>item selected</div>
          <div className={cx(item, focused)}>item focused</div>
        </Stack>
      </DemoBox>
    </Stack>
  );
}
