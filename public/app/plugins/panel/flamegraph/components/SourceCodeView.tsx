import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';
import { EditorView, gutter, GutterMarker, lineNumbers } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import CodeMirror, { minimalSetup, ReactCodeMirrorRef } from '@uiw/react-codemirror';
import React, { createRef, useEffect, useState } from 'react';

import { useTheme2 } from '@grafana/ui';

import { PhlareDataSource } from '../../../datasource/phlare/datasource';
import { CodeLocation } from '../../../datasource/phlare/types';

interface Props {
  datasource: PhlareDataSource;
  location: CodeLocation;
  getLabelValue: (label: string | number) => string;
  getFileNameValue: (label: string | number) => string;
}

const highHeat = cx(
  css({
    backgroundColor: 'red',
    color: 'white',
  })
);

const medHeat = cx(
  css({
    backgroundColor: 'orange',
    color: 'black',
  })
);

const heatGutterClass = cx(
  css({
    minWidth: 60,
    textAlign: 'right',
  })
);

export function SourceCodeView(props: Props) {
  const { datasource, location, getLabelValue, getFileNameValue } = props;
  const [source, setSource] = useState<string>('');
  const editorRef = createRef<ReactCodeMirrorRef>();
  const theme = useTheme2();

  const lineHeats = [
    195, 116, 90, 193, 63, 71, 129, 168, 198, 177, 197, 167, 216, 205, 11, 220, 12, 12, 74, 107, 211, 145, 85, 142, 208,
    48, 239, 5, 100, 25, 93, 206, 46, 36, 127, 94, 147, 176, 18, 224, 41, 69, 230, 45, 118, 92, 126, 152, 8, 185,
  ];

  const maxRawVal = 350;

  // TODO: create pre-defined pallete of heat markers (maybe 32?)
  class HeatMarker extends GutterMarker {
    rawValue: number;

    // heatPct: number;

    constructor(rawValue: number /*heatPct: number*/) {
      super();
      this.rawValue = rawValue;
      // this.heatPct = heatPct;
    }

    eq(other: HeatMarker) {
      return this.rawValue === other.rawValue;
    }

    toDOM() {
      return document.createTextNode(this.rawValue.toString() + 'ms');
    }
  }

  class HighHeatMarker extends HeatMarker {
    elementClass = highHeat;
  }

  class MedHeatMarker extends HeatMarker {
    elementClass = medHeat;
  }

  const heatGutter = gutter({
    class: heatGutterClass,

    // TODO: replace this with a pre-computed markers: GutterMarker[] ?
    lineMarker(view, line) {
      let lineNum = view.state.doc.lineAt(line.from).number;
      const index = lineNum % 70 || 0;
      let heatRawVal = lineHeats[index] || 0;
      let heatPct = heatRawVal / maxRawVal;
      let marker =
        heatPct === 0 ? null : heatPct > 0.5 ? new HighHeatMarker(heatRawVal) : new MedHeatMarker(heatRawVal);
      return marker;
    },
  });

  useEffect(() => {
    (async () => {
      const sourceCode = await datasource.getSource(getLabelValue(location.func), getFileNameValue(location.fileName));
      setSource(sourceCode);
    })();
  }, [editorRef, datasource, location, getLabelValue, getFileNameValue]);

  useEffect(() => {
    const line = editorRef.current?.view?.state.doc.line(location.line);
    editorRef.current?.view?.dispatch({
      selection: { anchor: line?.from || 0 },
      scrollIntoView: true,
      effects: EditorView.scrollIntoView(line?.from || 0, { y: 'start' }),
    });
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CodeMirror
      value={source}
      height={'630px'}
      extensions={[StreamLanguage.define(go), minimalSetup(), lineNumbers(), heatGutter]}
      readOnly={true}
      theme={theme.name === 'Dark' ? 'dark' : 'light'}
      ref={editorRef}
    />
  );
}
