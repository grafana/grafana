import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';
import { EditorView, gutter, GutterMarker, lineNumbers } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import CodeMirror, { minimalSetup, ReactCodeMirrorRef } from '@uiw/react-codemirror';
import React, { createRef, useEffect, useMemo, useState } from 'react';

import { createTheme, DataFrame } from '@grafana/data';
// import { getContrastRatio } from '@grafana/data/src/themes/colorManipulator';
import { useTheme2 } from '@grafana/ui';

import { PhlareDataSource } from '../../../datasource/phlare/datasource';
// import { CodeLocation } from '../../../datasource/phlare/types';
import { quantizeScheme } from '../../heatmap/palettes';

// import { Item } from './FlameGraph/dataTransform';

const heatColors = quantizeScheme(
  { steps: 32, exponent: 1, reverse: true, fill: '#0000', scheme: 'YlOrRd' },
  createTheme()
);

const heatClasses = heatColors.map((color) => {
  // why is the range of this fn 1-21?
  // let contrast = getContrastRatio('#000', color);

  return cx(
    css({
      // backgroundColor: color,
      // color: contrast < 17 ? '#fff' : '#000',
      color: color + ' !important',
    })
  );
});

const heatGutterClass = cx(
  css({
    minWidth: 80,
    textAlign: 'right',
  })
);

class HeatMarker extends GutterMarker {
  rawValue: number;

  constructor(rawValue: number, heatFactor: number) {
    super();
    this.rawValue = rawValue;

    // console.log(heatFactor);

    const heatColorIdx = Math.floor(heatFactor * (heatClasses.length - 1));

    this.elementClass = heatClasses[heatColorIdx];
  }

  eq(other: HeatMarker) {
    return this.rawValue === other.rawValue;
  }

  toDOM() {
    return document.createTextNode(this.rawValue.toPrecision(3));
  }
}

// (excluding root)
export type GloblDataRanges = {
  value: [min: number, max: number];
  self: [min: number, max: number];
};

interface Props {
  datasource: PhlareDataSource;
  locationIdx: number;
  data: DataFrame;
  globalDataRanges: GloblDataRanges;
  getLabelValue: (label: string | number) => string;
}

export function SourceCodeView(props: Props) {
  const { datasource, locationIdx, data, globalDataRanges, getLabelValue } = props;
  const [source, setSource] = useState<string>('');
  const editorRef = createRef<ReactCodeMirrorRef>();
  const theme = useTheme2();

  const { lineData, valueData, selfData, fileNameData, fileNameEnum, labelData } = useMemo(() => {
    let fileNameField = data.fields.find((f) => f.name === 'fileName')!;
    let labelField = data.fields.find((f) => f.name === 'label')!;

    return {
      fileNameEnum: fileNameField.config.type!.enum?.text!,
      fileNameData: fileNameField.values.toArray(),

      // labelEnum: labelField.config.type!.enum?.text,
      labelData: labelField.values.toArray(),

      lineData: data.fields.find((f) => f.name === 'line')!.values.toArray(),
      valueData: data.fields.find((f) => f.name === 'value')!.values.toArray(),
      selfData: data.fields.find((f) => f.name === 'self')!.values.toArray(),
    };
  }, [data]);

  // these are the field.values idxs of stuff in this file
  const dataIdxs = useMemo(() => {
    let idxs = [];

    let fileIdx = fileNameData[locationIdx];

    for (let i = 0; i < fileNameData.length; i++) {
      if (fileNameData[i] === fileIdx) {
        idxs.push(i);
      }
    }

    return idxs;
  }, [locationIdx, fileNameData]);

  const byLineData = useMemo(() => {
    let byLineData = {
      value: new Map<number, number>(),
      self: new Map<number, number>(),
    };

    for (let i = 0; i < dataIdxs.length; i++) {
      let idx = dataIdxs[i];
      let line = lineData[idx];
      byLineData.value.set(line, valueData[idx]);
      byLineData.self.set(line, selfData[idx]);
    }

    // console.log(byLineData);

    return byLineData;
  }, [dataIdxs, lineData, valueData, selfData]);

  const [minRawVal, maxRawVal] = globalDataRanges.value;
  const [minRawSelf, maxRawSelf] = globalDataRanges.self;

  // console.log({
  //   minRawVal,
  //   maxRawVal,
  // });

  const valueGutter = gutter({
    class: heatGutterClass,

    // TODO: optimize, this is recreated each time you navigate through source doc
    // should switch to the static gutter.markers: API
    lineMarker(view, line) {
      let lineNum = view.state.doc.lineAt(line.from).number;
      let rawValue = byLineData.value.get(lineNum) ?? 0;
      let heatFactor = rawValue > 0 ? (rawValue - minRawVal) / (maxRawVal - minRawVal) : 0;
      let marker = heatFactor === 0 ? null : new HeatMarker(rawValue, heatFactor);
      return marker;
    },
  });

  const selfGutter = gutter({
    class: heatGutterClass,

    // TODO: optimize, this is recreated each time you navigate through source doc
    // should switch to the static gutter.markers: API
    lineMarker(view, line) {
      let lineNum = view.state.doc.lineAt(line.from).number;
      let rawValue = byLineData.value.get(lineNum) ?? 0;
      let heatFactor = rawValue > 0 ? (rawValue - minRawSelf) / (maxRawSelf - minRawSelf) : 0;
      let marker = heatFactor === 0 ? null : new HeatMarker(rawValue, heatFactor);
      return marker;
    },
  });

  useEffect(() => {
    (async () => {
      const sourceCode = await datasource.getSource(
        getLabelValue(labelData[locationIdx]),
        fileNameEnum[fileNameData[locationIdx]]
      );
      setSource(sourceCode);
    })();
  }, [editorRef, datasource, locationIdx, fileNameEnum, labelData, fileNameData, getLabelValue]);

  useEffect(() => {
    const line = editorRef.current?.view?.state.doc.line(lineData[locationIdx]);

    editorRef.current?.view?.dispatch({
      selection: { anchor: line?.from || 0 },
      scrollIntoView: true,
      effects: EditorView.scrollIntoView(line?.from || 0, { y: 'center' }),
    });
  }, [source, lineData, editorRef, locationIdx]);

  return (
    <CodeMirror
      value={source}
      height={'630px'}
      extensions={[StreamLanguage.define(go), minimalSetup(), lineNumbers(), valueGutter, selfGutter]}
      readOnly={true}
      theme={theme.name === 'Dark' ? vscodeDark : 'light'}
      ref={editorRef}
    />
  );
}
