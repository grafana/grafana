import { type Meta, type StoryFn } from '@storybook/react';
import { useMemo } from 'react';

import { createDataFrame, FieldType } from '@grafana/data';

import { useTheme2 } from '../../../themes/ThemeContext';
import { prepDataForStorybook } from '../../../utils/storybook/data';

import { TableNG } from './TableNG';

interface Args {
  textLength: number;
}

const meta: Meta<Args> = {
  title: 'Plugins/Table NG',
  args: { textLength: 28_000 },
  argTypes: { textLength: { control: { type: 'number', min: 1, max: 100_000 } } },
};

export const WrappingFallback: StoryFn<Args> = ({ textLength }) => {
  const theme = useTheme2();
  const data = useMemo(() => {
    const trace = 'Error: request failed\n    at handleRequest (server.ts:42:10)\n';
    return prepDataForStorybook(
      [
        createDataFrame({
          fields: [
            { name: 'Request', type: FieldType.number, values: Array.from({ length: 156 }, (_, i) => i) },
            {
              name: 'Message',
              type: FieldType.string,
              values: Array.from({ length: 156 }, (_, i) =>
                i === 120
                  ? trace.repeat(Math.ceil(textLength / trace.length)).slice(0, textLength)
                  : `Request ${i}\nCompleted`
              ),
              config: { custom: { wrapText: true, width: 500 } },
            },
          ],
        }),
      ],
      theme
    )[0];
  }, [theme, textLength]);

  return <TableNG data={data} width={800} height={500} structureRev={1} maxRowHeight={100} />;
};

export default meta;
