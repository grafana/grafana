import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';
import { oneDark } from '@codemirror/theme-one-dark';
import { gutter, GutterMarker, lineNumbers } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import { minimalSetup, EditorView } from 'codemirror';
import React, { createRef, useEffect, useState } from 'react';

// import { GrafanaTheme2 } from '@grafana/data';
// import { CodeEditor, useTheme2 } from '@grafana/ui';

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
  // const { datasource, location, getLabelValue, getFileNameValue } = props;
  // const [source, setSource] = useState<string>('');
  // const theme = useTheme2();
  // const styles = getStyles(theme);

  const root = createRef<HTMLDivElement>();

  //------------REPLACE WITH VALUES FROM PROPS & FETCH---------------
  const srcCode = `package main
import "fmt"

func main() {
  fmt.Println("Hello, 世界")
}`;

  const lineHeats = [0, 0, 0, 215, 35, 0];

  const maxRawVal = 350;
  //------------REPLACE WITH VALUES FROM PROPS & FETCH---------------

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
      let heatRawVal = lineHeats[lineNum - 1];
      let heatPct = heatRawVal / maxRawVal;
      let marker =
        heatPct === 0 ? null : heatPct > 0.5 ? new HighHeatMarker(heatRawVal) : new MedHeatMarker(heatRawVal);
      return marker;
    },
  });

  useEffect(() => {
    let view = new EditorView({
      doc: srcCode,
      extensions: [
        minimalSetup,
        lineNumbers(),
        heatGutter,
        EditorView.editable.of(false),
        StreamLanguage.define(go),
        oneDark,
      ],
      parent: root.current!,
    });

    return () => {
      view.destroy();
    };
  }, []);

  return <div ref={root}></div>;

  /*
  useEffect(() => {
    (async () => {
      const sourceCode = await datasource.getSource(getLabelValue(location.func), getFileNameValue(location.fileName));
      setSource(sourceCode);
    })();
  }, [datasource, location, getLabelValue, getFileNameValue]);

  return (
    <CodeEditor
      value={source}
      language={'go'}
      containerStyles={styles.queryField}
      readOnly={true}
      showLineNumbers={true}
      monacoOptions={{
        fontSize: 14,
      }}
    />
  );
  */
}

// interface EditorStyles {
//   queryField: string;
// }

// const getStyles = (theme: GrafanaTheme2): EditorStyles => {
//   return {
//     queryField: css`
//       float: left;
//       width: 50%;
//       height: 100%;
//     `,
//   };
// };
