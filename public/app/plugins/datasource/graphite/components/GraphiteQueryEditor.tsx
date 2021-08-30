import React from 'react';
import { Dispatch } from 'redux';
import { GraphiteQueryEditorState } from '../state/store';
import { GraphiteTextEditor } from './GraphiteTextEditor';
import { SeriesSection } from './SeriesSection';
import { GraphiteContext } from '../state/context';
import { FunctionsSection } from './FunctionsSection';

type Props = {
  state: GraphiteQueryEditorState;
  dispatch: Dispatch;
};

export function GraphiteQueryEditor({ dispatch, state }: Props) {
  return (
    <GraphiteContext dispatch={dispatch}>
      {state.target?.textEditor && <GraphiteTextEditor rawQuery={state.target.target} />}
      {!state.target?.textEditor && (
        <>
          <SeriesSection state={state} />
          <FunctionsSection functions={state.queryModel?.functions} funcDefs={state.funcDefs!} />
        </>
      )}
    </GraphiteContext>
  );
}
