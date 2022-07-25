import React from 'react';

import { SegmentSection } from '@grafana/ui';

import { FuncDefs, FuncInstance } from '../gfunc';

import { AddGraphiteFunction } from './AddGraphiteFunction';
import { GraphiteFunctionEditor } from './GraphiteFunctionEditor';

type Props = {
  functions: FuncInstance[];
  funcDefs: FuncDefs;
};

export function FunctionsSection({ functions = [], funcDefs }: Props) {
  return (
    <SegmentSection label="Functions" fill={true}>
      {functions.map((func: FuncInstance, index: number) => {
        return !func.hidden && <GraphiteFunctionEditor key={index} func={func} />;
      })}
      <AddGraphiteFunction funcDefs={funcDefs} />
    </SegmentSection>
  );
}
