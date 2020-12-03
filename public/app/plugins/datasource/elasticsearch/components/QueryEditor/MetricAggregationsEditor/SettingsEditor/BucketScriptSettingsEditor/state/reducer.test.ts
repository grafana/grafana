import { reducerTester } from 'test/core/redux/reducerTester';
import { PipelineVariable } from '../../../aggregations';
import {
  addPipelineVariable,
  changePipelineVariableMetric,
  removePipelineVariable,
  renamePipelineVariable,
} from './actions';
import { reducer } from './reducer';

describe('BucketScript Settings Reducer', () => {
  it('Should correctly add new pipeline variable', () => {
    const expectedPipelineVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    reducerTester()
      .givenReducer(reducer, [])
      .whenActionIsDispatched(addPipelineVariable())
      .thenStateShouldEqual([expectedPipelineVar]);
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

    reducerTester()
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

    reducerTester()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(renamePipelineVariable(expectedSecondVar.name, 1))
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

    reducerTester()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(changePipelineVariableMetric(expectedSecondVar.pipelineAgg, 1))
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

    reducerTester()
      .givenReducer(reducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
