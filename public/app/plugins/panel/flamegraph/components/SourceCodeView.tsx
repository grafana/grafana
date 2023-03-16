import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';
import { EditorView, gutter, GutterMarker, lineNumbers } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import CodeMirror, { minimalSetup, ReactCodeMirrorRef } from '@uiw/react-codemirror';
import React, { createRef, useEffect, useMemo, useState } from 'react';

import { createTheme, DataFrame, Field, getDisplayProcessor } from '@grafana/data';
// import { getContrastRatio } from '@grafana/data/src/themes/colorManipulator';
import { useTheme2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { PhlareDataSource } from '../../../datasource/phlare/datasource';
// import { CodeLocation } from '../../../datasource/phlare/types';
import { quantizeScheme } from '../../heatmap/palettes';

import { oneDarkGrafana } from './one-dark-grafana';
import { SampleUnit } from './types';

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
  rawValue: string;

  constructor(rawValue: string, heatFactor: number) {
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
    return document.createTextNode(this.rawValue);
  }
}

// (excluding root)
export type GloblDataRanges = {
  value: [min: number, max: number];
  self: [min: number, max: number];
};

interface Props {
  datasource: PhlareDataSource;
  locationIdx?: number;
  fileName?: string;
  data: DataFrame;
  globalDataRanges: GloblDataRanges;
  getLabelValue: (label: string | number) => string;
}

export function SourceCodeView(props: Props) {
  const { datasource, locationIdx, data, globalDataRanges, getLabelValue } = props;
  const [source, setSource] = useState<string>('');
  const editorRef = createRef<ReactCodeMirrorRef>();
  const theme = useTheme2();

  const { lineData, valueData, selfData, fileNameData, fileNameEnum, labelData, valueField, selfField } =
    useMemo(() => {
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

        valueField: data.fields.find((f) => f.name === 'value')!,
        selfField: data.fields.find((f) => f.name === 'self')!,
      };
    }, [data]);

  // these are the field.values idxs of stuff in this file
  const dataIdxs = useMemo(() => {
    let idxs = [];

    let fileIdx = locationIdx ? fileNameData[locationIdx] : fileNameEnum.findIndex((val) => val === props.fileName!);

    for (let i = 0; i < fileNameData.length; i++) {
      if (fileNameData[i] === fileIdx) {
        idxs.push(i);
      }
    }

    return idxs;
  }, [locationIdx, fileNameData, props.fileName, fileNameEnum]);

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
      const unitValue = getUnitValue(valueField, rawValue);
      let marker = heatFactor === 0 ? null : new HeatMarker(unitValue, heatFactor);
      return marker;
    },
  });

  const selfGutter = gutter({
    class: heatGutterClass,

    // TODO: optimize, this is recreated each time you navigate through source doc
    // should switch to the static gutter.markers: API
    lineMarker(view, line) {
      let lineNum = view.state.doc.lineAt(line.from).number;
      let rawValue = byLineData.self.get(lineNum) ?? 0;
      let heatFactor = rawValue > 0 ? (rawValue - minRawSelf) / (maxRawSelf - minRawSelf) : 0;
      const unitValue = getUnitValue(selfField, rawValue);
      let marker = heatFactor === 0 ? null : new HeatMarker(unitValue, heatFactor);
      return marker;
    },
  });

  const notifyApp = useAppNotification();

  useEffect(() => {
    (async () => {
      try {
        const sourceCode = await datasource.getSource(
          locationIdx ? fileNameEnum[fileNameData[locationIdx]] : props.fileName!,
          locationIdx ? getLabelValue(labelData[locationIdx]) : undefined
        );
        setSource(sourceCode);
      } catch (e: any) {
        notifyApp.error('Error getting source file', e.message || e.data?.error);
      }
    })();
  }, [
    editorRef,
    datasource,
    locationIdx,
    fileNameEnum,
    labelData,
    fileNameData,
    getLabelValue,
    notifyApp,
    props.fileName,
  ]);

  const getUnitValue = (field: Field, value: number) => {
    const processor = getDisplayProcessor({ field, theme });
    const displayValue = processor(value);
    let unitValue = displayValue.text + displayValue.suffix;

    switch (field.config.unit) {
      case SampleUnit.Bytes:
        break;
      case SampleUnit.Nanoseconds:
        break;
      default:
        if (!displayValue.suffix) {
          // Makes sure we don't show 123undefined or something like that if suffix isn't defined
          unitValue = displayValue.text;
        }
        break;
    }

    return unitValue;
  };

  useEffect(() => {
    if (!source || !locationIdx) {
      return;
    }

    try {
      const line = editorRef.current?.view?.state.doc.line(lineData[locationIdx]);
      editorRef.current?.view?.dispatch({
        selection: { anchor: line?.from || 0 },
        scrollIntoView: true,
        effects: EditorView.scrollIntoView(line?.from || 0, { y: 'center' }),
      });
    } catch (e) {
      console.error('Error scrolling to line', e);
    }
  }, [source, lineData, editorRef, locationIdx]);

  return (
    <CodeMirror
      value={source}
      height={'800px'}
      extensions={[StreamLanguage.define(go), minimalSetup(), lineNumbers(), selfGutter, valueGutter, EditorView.editable.of(false),]}
      readOnly={true}
      theme={theme.name === 'Dark' ? oneDarkGrafana : 'light'}
      ref={editorRef}
    />
  );
}
