import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';
import * as React from 'react';

import { Divider } from '../Divider/Divider';
import { Field } from '../Forms/Field';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

const meta: Meta = {
  title: 'Developers/Typography',
  parameters: {
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

const FONT_WEIGHTS = [/*100, 200, 300, */ 400, 500 /*600, 700, 800, 900*/];

export const TypographySamples: StoryFn = () => {
  const [fontWeight, setFontWeight] = useState(400);
  const [fontSize, setFontSize] = useState(30);

  const handleFontWeightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFontWeight(Number(event.target.value));
  };

  const handleFontSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFontSize(Number(event.target.value));
  };

  return (
    <div style={{ fontSynthesis: 'none' }}>
      <Field label={`Font weight - ${fontWeight}`}>
        <input
          type="range"
          min={100}
          max={900}
          step={10}
          value={fontWeight}
          onChange={handleFontWeightChange}
          style={{ width: '100%', maxWidth: 400 }}
        />
      </Field>

      <Field label={`Font size - ${fontSize}`}>
        <input
          type="range"
          min={8}
          max={100}
          value={fontSize}
          onChange={handleFontSizeChange}
          style={{ width: '100%', maxWidth: 400 }}
        />
      </Field>

      <div style={{ fontWeight: fontWeight, fontSize: fontSize }}>Add new time series panel to Grafana dashboard</div>

      <Divider />

      <Stack direction="column" gap={4}>
        {FONT_WEIGHTS.map((weight) => {
          return (
            <div key={weight}>
              <Text>Font weight {weight}</Text>

              <div style={{ fontWeight: weight, fontSize: fontSize }} contentEditable>
                Add new time series panel
                <br />
                Figure A⃝ #⃞ 3⃝ ×⃞
                <br />
                3x9 12:34 3–8 +8+x
                <br />
                01 02 03 04 05 06 07 08 09 00
                <br />
                11 12 13 14 15 16 17 18 19 10
                <div style={{ fontFeatureSettings: '"tnum"' }}>
                  01 02 03 04 05 06 07 08 09 00
                  <br />
                  11 12 13 14 15 16 17 18 19 10
                </div>
              </div>
            </div>
          );
        })}
      </Stack>
    </div>
  );
};

export default meta;
