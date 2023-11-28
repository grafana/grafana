import { reducerTester } from 'test/core/redux/reducerTester';
import { addPipelineVariable, changePipelineVariableMetric, removePipelineVariable, renamePipelineVariable, } from './actions';
import { reducer } from './reducer';
describe('BucketScript Settings Reducer', () => {
    it('Should correctly add new pipeline variables', () => {
        const var1 = {
            name: 'var1',
            pipelineAgg: '',
        };
        const var2 = {
            name: 'var2',
            pipelineAgg: '',
        };
        const var3 = {
            name: 'var3',
            pipelineAgg: '',
        };
        reducerTester()
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
        const firstVar = {
            name: 'var1',
            pipelineAgg: '',
        };
        const secondVar = {
            name: 'var2',
            pipelineAgg: '',
        };
        reducerTester()
            .givenReducer(reducer, [firstVar, secondVar])
            .whenActionIsDispatched(removePipelineVariable(0))
            .thenStateShouldEqual([secondVar]);
    });
    it('Should correctly rename pipeline variable', () => {
        const firstVar = {
            name: 'var1',
            pipelineAgg: '',
        };
        const secondVar = {
            name: 'var2',
            pipelineAgg: '',
        };
        const expectedSecondVar = Object.assign(Object.assign({}, secondVar), { name: 'new name' });
        reducerTester()
            .givenReducer(reducer, [firstVar, secondVar])
            .whenActionIsDispatched(renamePipelineVariable({ newName: expectedSecondVar.name, index: 1 }))
            .thenStateShouldEqual([firstVar, expectedSecondVar]);
    });
    it('Should correctly change pipeline variable target metric', () => {
        const firstVar = {
            name: 'var1',
            pipelineAgg: '',
        };
        const secondVar = {
            name: 'var2',
            pipelineAgg: 'some agg',
        };
        const expectedSecondVar = Object.assign(Object.assign({}, secondVar), { pipelineAgg: 'some new agg' });
        reducerTester()
            .givenReducer(reducer, [firstVar, secondVar])
            .whenActionIsDispatched(changePipelineVariableMetric({ newMetric: expectedSecondVar.pipelineAgg, index: 1 }))
            .thenStateShouldEqual([firstVar, expectedSecondVar]);
    });
    it('Should not change state with other action types', () => {
        const initialState = [
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
//# sourceMappingURL=reducer.test.js.map