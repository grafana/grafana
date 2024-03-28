import { css, cx } from '@emotion/css';
import { slice } from 'lodash';
import React from 'react';

import color from '../../saga-themes/code/core/color';
import { useTheme2, useTheme3 } from '../../themes/ThemeContext';
import { Divider } from '../Divider/Divider';
import { Stack } from '../Layout/Stack/Stack';
import { Select } from '../Select/Select';
import { Text } from '../Text/Text';

interface DemoBoxProps {
  bg?: string;
  border?: string;
  height?: number | string;
}

const DemoBox = ({ bg, border, height, children }: React.PropsWithChildren<DemoBoxProps>) => {
  const style = cx(
    css({
      padding: '16px',
      background: bg ?? 'inherit',
      height: height || '30px',
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

const BasicText = ({ children, font }: React.PropsWithChildren<{ font: string }>) => {
  const style = css({
    font: font,
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
  direction = 'row',
}: {
  colors: { [key: string]: string };
  children: JSX.Element;
  propName: string;
  ignore?: string[];
  boxWidth?: string;
  direction?: 'row' | 'row-reverse';
}) => {
  return Object.keys(colors).map((key) => {
    if (ignore?.includes(key)) {
      return;
    }
    return (
      <Stack direction={direction} key={key} alignItems="center">
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
  const theme2 = useTheme2();
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

export function TypographyDemo() {
  const theme = useTheme3();
  const typography = theme.font;

  return (
    <Stack>
      <Stack direction="column">
        <Text variant="h1">Theme V3</Text>
        <Divider />
        <BasicText font={typography.h1}>H1</BasicText>
        <BasicText font={typography.h2}>H2</BasicText>
        <BasicText font={typography.h3}>H3</BasicText>
        <BasicText font={typography.h4}>H4</BasicText>
        <BasicText font={typography.h5}>H5</BasicText>
        <BasicText font={typography.h6}>H6</BasicText>
        <BasicText font={typography.body}>Body</BasicText>
        <BasicText font={typography.bodySmall}>Body Small</BasicText>
      </Stack>
      <Stack direction="column">
        <Text variant="h1">Theme V2</Text>
        <Divider />
        <Text variant="h1">H1</Text>
        <Text variant="h2">H2</Text>
        <Text variant="h3">H3</Text>
        <Text variant="h4">H4</Text>
        <Text variant="h5">H5</Text>
        <Text variant="h6">H6</Text>
        <Text variant="body">Body</Text>
        <Text variant="bodySmall">Body Small</Text>
      </Stack>
    </Stack>
  );
}

function flattenObject(ob) {
  let toReturn: { [key: string]: string } = {};

  for (let i in ob) {
    if (!ob.hasOwnProperty(i)) {
      continue;
    }

    if (typeof ob[i] === 'object' && ob[i] !== null) {
      let flatObject = flattenObject(ob[i]);
      for (let x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) {
          continue;
        }

        toReturn[i + '.' + x] = flatObject[x];
      }
    } else if (typeof ob[i] === 'string') {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}
export function ColorCompare() {
  const theme = useTheme3();
  const theme2 = useTheme2();
  const colors = theme.color;
  const flatTheme = flattenObject(colors);
  const flatTheme2 = flattenObject(theme2.colors);
  const flatTheme2Components = flattenObject(theme2.components);
  const [selectedColor, setSelectedColor] = React.useState<string>();
  console.info(flatTheme2Components);

  const options = Object.keys({ ...flatTheme2, ...flatTheme2Components }).map((name) => ({
    value: flatTheme2[name] || flatTheme2Components[name],
    label: name,
  }));

  return (
    <Stack>
      <Stack direction="column">
        <Select options={options} onChange={(v) => setSelectedColor(v.value)} />
        <Text variant="h1">Theme</Text>
        <Divider />
        <Stack>
          <DemoBox bg={selectedColor} height="100%" />
          <Stack gap={0} direction="column">
            <FlatColorList colors={flatTheme} propName="bg" direction="row-reverse">
              <DemoBox />
            </FlatColorList>
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}
