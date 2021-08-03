import React from 'react';
import { Dispatch } from 'redux';
import { GraphiteQueryEditorState } from '../state/store';
import { GraphiteTextEditor } from './GraphiteTextEditor';
import { SeriesSection } from './SeriesSection';
import { PlayButton } from './PlayButton';
import { GraphiteFunctionEditor } from './GraphiteFunctionEditor';
import { FuncInstance } from '../gfunc';
import { AddGraphiteFunction } from './AddGraphiteFunction';
import { GraphiteContext } from '../state/context';

type Props = {
  state: GraphiteQueryEditorState;
  dispatch: Dispatch;
};

export function GraphiteQueryEditor({ dispatch, state }: Props) {
  return (
    <GraphiteContext dispatch={dispatch}>
      {state.target?.textEditor && <GraphiteTextEditor rawQuery={state.target.target} />}

      {!state.target?.textEditor && (
        <div ng-hide="ctrl.target.textEditor">
          <div className="gf-form-inline">
            <div className="gf-form">
              <label className="gf-form-label width-6 query-keyword">Series</label>
            </div>

            <SeriesSection state={state} />

            {state.paused && <PlayButton />}

            <div className="gf-form gf-form--grow">
              <div className="gf-form-label gf-form-label--grow" />
            </div>
          </div>

          <div className="gf-form-inline">
            <div className="gf-form">
              <label className="gf-form-label width-6 query-keyword">Functions</label>
            </div>

            {state.queryModel?.functions.map((func: FuncInstance, index: number) => {
              return <GraphiteFunctionEditor key={index} func={func} />;
            })}

            <AddGraphiteFunction funcDefs={state.funcDefs!} />

            <div className="gf-form gf-form--grow">
              <div className="gf-form-label gf-form-label--grow" />
            </div>
          </div>
        </div>
      )}
    </GraphiteContext>
  );
}
