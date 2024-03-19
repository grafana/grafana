import { css, cx } from '@emotion/css';
import React from 'react';

import color from '../../saga-themes/code/core/color';
import { useTheme3 } from '../../themes/ThemeContext';
import { Divider } from '../Divider/Divider';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

interface DemoBoxProps {
  bg?: string;
  border?: string;
}

const DemoBox = ({ bg, border, children }: React.PropsWithChildren<DemoBoxProps>) => {
  const style = cx(
    css({
      padding: '16px',
      background: bg ?? 'inherit',
      height: '30px',
      width: '30px',
    }),
    border
      ? css({
          border: `1px solid ${border}`,
        })
      : null
  );

  return <div className={style}>{children}</div>;
};

const DemoText = ({
  color,
  bold,
  size,
  children,
}: React.PropsWithChildren<{ color?: string; bold?: boolean; size?: number }>) => {
  const style = css({
    padding: '4px',
    color: color ?? 'inherit',
    fontWeight: bold ? 500 : 400,
    fontSize: `${size ?? 14}px`,
  });

  return <div className={style}>{children}</div>;
};

export function CoreColorsDemo() {
  const colors = color.color;

  return (
    <Stack direction="column">
      <ColorList colors={colors} propName="bg" ignore={['modifier']} boxWidth="30px">
        <DemoBox border={color.color.base.white} />
      </ColorList>
    </Stack>
  );
}

const ColorList = ({
  colors,
  children,
  propName,
  ignore,
  boxWidth = '80px',
}: {
  colors: Record<string, Record<string, string>>;
  children: JSX.Element;
  propName: string;
  ignore?: string[];
  boxWidth?: string;
}) => {
  return Object.keys(colors).map((key) => {
    if (ignore?.includes(key)) {
      return;
    }
    return (
      <Stack direction="row" key={key} alignItems="center">
        <div style={{ width: '100px' }}>
          <Text variant="h4">{key}</Text>
        </div>
        <Stack direction="row">
          {Object.keys(colors[key]).map((colorKey) => {
            return (
              <div key={colorKey} style={{ width: boxWidth }}>
                {colorKey}

                {React.cloneElement(children, { [propName]: colors[key][colorKey] })}
              </div>
            );
          })}
        </Stack>
      </Stack>
    );
  });
};

const FlatColorList = ({
  colors,
  children,
  propName,
  ignore,
  boxWidth = '80px',
}: {
  colors: { [key: string]: string };
  children: JSX.Element;
  propName: string;
  ignore?: string[];
  boxWidth?: string;
}) => {
  return Object.keys(colors).map((key) => {
    if (ignore?.includes(key)) {
      return;
    }
    return (
      <Stack direction="row" key={key} alignItems="center">
        <div style={{ width: '100px' }}>
          <Text variant="h4">{key}</Text>
        </div>
        <div key={key} style={{ width: boxWidth }}>
          {React.cloneElement(children, { [propName]: colors[key] })}
        </div>
      </Stack>
    );
  });
};

export function ThemeColorsDemo() {
  const theme = useTheme3();
  const colors = theme.color;

  return (
    <Stack direction="column">
      <Text variant="h2">Background</Text>
      <ColorList colors={colors.background} propName="bg">
        <DemoBox border={color.color.base.white} />
      </ColorList>
      <Divider />
      <Text variant="h2">Border</Text>
      <ColorList colors={colors.border} propName="border">
        <DemoBox />
      </ColorList>
      <Divider />
      <Text variant="h2">Text</Text>
      <FlatColorList colors={colors.content} propName="color" ignore={['system']}>
        <DemoText>Test</DemoText>
      </FlatColorList>
      <ColorList colors={colors.content.system} propName="color">
        <DemoText>Test</DemoText>
      </ColorList>
    </Stack>
  );
}
