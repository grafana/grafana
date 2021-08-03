import React from 'react';
import { FuncDefs, FuncInstance } from '../gfunc';
import { GraphiteFunctionEditor } from './GraphiteFunctionEditor';
import { AddGraphiteFunction } from './AddGraphiteFunction';

type Props = {
  functions: FuncInstance[];
  funcDefs: FuncDefs;
};

export function FunctionsSection({ functions = [], funcDefs }: Props) {
  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <label className="gf-form-label width-6 query-keyword">Functions</label>
      </div>
      <div className="gf-form">
        {functions.map((func: FuncInstance, index: number) => {
          return <GraphiteFunctionEditor key={index} func={func} />;
        })}
      </div>
      <AddGraphiteFunction funcDefs={funcDefs} />
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </div>
  );
}
