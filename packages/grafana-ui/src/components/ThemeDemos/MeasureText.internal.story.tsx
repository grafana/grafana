import { Meta, StoryFn } from '@storybook/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CellProps } from '../../types/interactiveTable';
import { measureText, measureTextCSS, measureTextTnum } from '../../utils/measureText';
import { InteractiveTable } from '../InteractiveTable/InteractiveTable';

const meta: Meta = {
  title: 'Docs Overview/Theme',
  // component: BorderRadiusContainer,
  decorators: [],
  parameters: {
    // layout: 'centered',
  },
  args: {
    tabularNumbers: false,
  },
  argTypes: {
    tabularNumbers: {
      control: 'boolean',
      description: 'Enable tabular numbers for consistent digit alignment',
    },
  },
};

const strings = [
  'Hello, @grafana/ui!', //
  '123 George St, Singleton, 2330, Australia', //
  '1234567890',
  '1111111111',
  '11111111110',
];

const fontFamily = 'Inter';
const fontSize = 16;
const fontWeight = 400;

function serializeTextMetrics(metrics: any): Record<string, any> {
  const props = Object.getOwnPropertyNames(Object.getPrototypeOf(metrics));
  const out: any = {};
  for (const prop of props) {
    try {
      const val = metrics[prop];
      if (typeof val === 'number') {
        out[prop] = val;
      }
    } catch {}
  }
  return out;
}

export const MeasureText: StoryFn<{ tabularNumbers: boolean }> = ({ tabularNumbers }) => {
  const [measure, setMeasure] = useState(0);

  useEffect(() => {
    document.body.style.fontVariantNumeric = tabularNumbers ? 'tabular-nums' : 'initial';

    document.fonts.ready.then(() => setMeasure((v) => v + 1));
  }, [tabularNumbers]);

  const rows = useMemo(() => {
    if (measure === 0) {
      return [];
    }

    return strings.flatMap((str, index) => {
      const canvasMeasure = measureText(str, fontSize, fontWeight);
      const canvasTnumMeasure = measureTextTnum(str, fontSize, fontWeight);
      const cssMeasure = measureTextCSS(str, {
        fontFamily,
        fontSize,
        fontWeight,
      });

      return [
        {
          id: (index * 3).toString(),
          method: 'measureText',
          text: str,
          width: canvasMeasure.width,
          widthDifference: canvasMeasure.width - cssMeasure.width,
          height: canvasMeasure.actualBoundingBoxAscent + canvasMeasure.actualBoundingBoxDescent,
        },
        {
          id: (index * 3 + 1).toString(),
          method: 'measureTextTnum',
          text: str,
          width: canvasTnumMeasure.width,
          widthDifference: canvasTnumMeasure.width - cssMeasure.width,
          height: canvasTnumMeasure.actualBoundingBoxAscent + canvasTnumMeasure.actualBoundingBoxDescent,
        },
        {
          id: (index * 3 + 2).toString(),
          method: 'measureTextCSS',
          text: str,
          width: cssMeasure.width,
          widthDifference: cssMeasure.width - canvasMeasure.width,
          height: cssMeasure.height,
        },
      ];
    });
  }, [measure]);

  const columns = useMemo(() => {
    return [
      { header: 'Method', id: 'method' },
      // { header: 'Text', id: 'text' },
      { header: 'Width', id: 'width' },
      // { header: 'Width diff', id: 'widthDifference' },
      // { header: 'Height', id: 'height' },
      {
        header: 'Rendered',
        id: 'rendered',
        cell: ({ row: { original: v } }: CellProps<(typeof rows)[number], void>) => (
          <span
            style={{
              width: v.width,
              // height: v.height,
              fontFamily,
              fontSize,
              fontWeight,
              whiteSpace: 'pre',
              display: 'inline-block',
              overflow: 'hidden',
              backgroundColor: 'red',
              letterSpacing: '0',
            }}
          >
            {v.text}
          </span>
        ),
      },
      // { header: 'Font Size', id: 'fontSize' },
      // { header: 'Font Weight', id: 'fontWeight' },
    ];
  }, []);

  return <InteractiveTable getRowId={(v) => v.id} columns={columns} data={rows} />;
};

export const MeasureTextPerf: StoryFn<{ tabularNumbers: boolean }> = (args) => {
  const iterations = 100_000;

  const [results, setResults] = useState<string[]>([]);

  const randomStrings = useMemo(() => {
    const strings = [];
    for (let i = 0; i < iterations; i++) {
      strings.push(Math.random().toString(36));
    }
    return strings;
  }, []);

  useEffect(() => {
    document.body.style.fontVariantNumeric = args.tabularNumbers ? 'tabular-nums' : 'initial';

    // document.fonts.ready.then(() => setMeasure((v) => v + 1));
  }, [args.tabularNumbers]);

  const handleStartClick = useCallback(async () => {
    await document.fonts.ready;

    // -- measureTextTnum measure
    performance.mark('measureTextTnum-start');
    for (const str of randomStrings) {
      measureTextTnum(str, fontSize, fontWeight);
    }
    performance.mark('measureTextTnum-end');
    const measureTextTnumResult = performance.measure(
      'measureTextTnum',
      'measureTextTnum-start',
      'measureTextTnum-end'
    );
    console.log('measureTextTnum duration:', measureTextTnumResult.duration, 'ms');

    // -- canvas measure
    performance.mark('measureText-start');
    for (const str of randomStrings) {
      measureText(str, fontSize, fontWeight);
    }
    performance.mark('measureText-end');
    const measureTextResult = performance.measure('measureText', 'measureText-start', 'measureText-end');
    console.log('measureText duration:', measureTextResult.duration, 'ms');

    // -- CSS measure
    performance.mark('measureTextCSS-start');
    const style = { fontSize, fontWeight, fontFamily };
    for (const str of randomStrings) {
      measureTextCSS(str, style);
    }
    performance.mark('measureTextCSS-end');
    const measureTextCSSResult = performance.measure('measureTextCSS', 'measureTextCSS-start', 'measureTextCSS-end');
    console.log('measureTextCSS duration:', measureTextCSSResult.duration, 'ms');

    setResults([
      `Iterations: ${iterations.toLocaleString()}`,
      `measureText duration: ${measureTextResult.duration.toFixed(2)} ms`,
      `measureTextTnum duration: ${measureTextTnumResult.duration.toFixed(2)} ms`,
      `measureTextCSS duration: ${measureTextCSSResult.duration.toFixed(2)} ms`,
    ]);
  }, [randomStrings]);

  return (
    <div>
      <p>Measure text performance demo</p>
      <p>11223344556677889900 (default)</p>
      <p style={{ fontFamily: 'Inter' }}>11223344556677889900 (Inter)</p>
      <p style={{ fontFamily: 'InterTnum' }}>11223344556677889900 (InterTnum)</p>
      <p style={{ fontFamily: 'InterTnum, Inter' }}>11223344556677889900 (InterTnum, Inter)</p>
      {results.map((result, index) => {
        return <p key={index}>{result}</p>;
      })}
      <button onClick={handleStartClick}>Start</button>
    </div>
  );
};

export default meta;
