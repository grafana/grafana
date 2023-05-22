import { reducerTester } from 'test/core/redux/reducerTester';

import { PipelineVariable } from '../../../../../../types';

import {
  addPipelineVariable,
  changePipelineVariableMetric,
  removePipelineVariable,
  renamePipelineVariable,
} from './actions';
import { reducer } from './reducer';

describe('BucketScript Settings Reducer', () => {
  it('Should correctly add new pipeline variables', () => {
    const var1: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    const var2: PipelineVariable = {
      name: 'var2',
      pipelineAgg: '',
    };

    const var3: PipelineVariable = {
      name: 'var3',
      pipelineAgg: '',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [])
      .whenActionIsDispatched(addPipelineVariable())
      .thenStateShouldEqual([var1])
      .whenActionIsDispatched(addPipelineVariable())
      .thenStateShouldEqual([var1, var2])
      .whenActionIsDispatched(removePipelineVariable(0))
      .thenStateShouldEqual([var2])
      .whenActionIsDispatched(addPipelineVariable())
      .thenStateShouldEqual([var2, var3]);
  });

  it('Should correctly remove pipeline variables', () => {
    const firstVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    const secondVar: PipelineVariable = {
      name: 'var2',
      pipelineAgg: '',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(removePipelineVariable(0))
      .thenStateShouldEqual([secondVar]);
  });

  it('Should correctly rename pipeline variable', () => {
    const firstVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    const secondVar: PipelineVariable = {
      name: 'var2',
      pipelineAgg: '',
    };

    const expectedSecondVar: PipelineVariable = {
      ...secondVar,
      name: 'new name',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(renamePipelineVariable({ newName: expectedSecondVar.name, index: 1 }))
      .thenStateShouldEqual([firstVar, expectedSecondVar]);
  });

  it('Should correctly change pipeline variable target metric', () => {
    const firstVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    const secondVar: PipelineVariable = {
      name: 'var2',
      pipelineAgg: 'some agg',
    };

    const expectedSecondVar: PipelineVariable = {
      ...secondVar,
      pipelineAgg: 'some new agg',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(changePipelineVariableMetric({ newMetric: expectedSecondVar.pipelineAgg, index: 1 }))
      .thenStateShouldEqual([firstVar, expectedSecondVar]);
  });

  it('Should not change state with other action types', () => {
    const initialState: PipelineVariable[] = [
      {
        name: 'var1',
        pipelineAgg: '1',
      },
      {
        name: 'var2',
        pipelineAgg: '2',
      },
    ];

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
