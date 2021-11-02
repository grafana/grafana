import { __assign } from "tslib";
import { reducerTester } from 'test/core/redux/reducerTester';
import { addPipelineVariable, changePipelineVariableMetric, removePipelineVariable, renamePipelineVariable, } from './actions';
import { reducer } from './reducer';
describe('BucketScript Settings Reducer', function () {
    it('Should correctly add new pipeline variables', function () {
        var var1 = {
            name: 'var1',
            pipelineAgg: '',
        };
        var var2 = {
            name: 'var2',
            pipelineAgg: '',
        };
        var var3 = {
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
    it('Should correctly remove pipeline variables', function () {
        var firstVar = {
            name: 'var1',
            pipelineAgg: '',
        };
        var secondVar = {
            name: 'var2',
            pipelineAgg: '',
        };
        reducerTester()
            .givenReducer(reducer, [firstVar, secondVar])
            .whenActionIsDispatched(removePipelineVariable(0))
            .thenStateShouldEqual([secondVar]);
    });
    it('Should correctly rename pipeline variable', function () {
        var firstVar = {
            name: 'var1',
            pipelineAgg: '',
        };
        var secondVar = {
            name: 'var2',
            pipelineAgg: '',
        };
        var expectedSecondVar = __assign(__assign({}, secondVar), { name: 'new name' });
        reducerTester()
            .givenReducer(reducer, [firstVar, secondVar])
            .whenActionIsDispatched(renamePipelineVariable({ newName: expectedSecondVar.name, index: 1 }))
            .thenStateShouldEqual([firstVar, expectedSecondVar]);
    });
    it('Should correctly change pipeline variable target metric', function () {
        var firstVar = {
            name: 'var1',
            pipelineAgg: '',
        };
        var secondVar = {
            name: 'var2',
            pipelineAgg: 'some agg',
        };
        var expectedSecondVar = __assign(__assign({}, secondVar), { pipelineAgg: 'some new agg' });
        reducerTester()
            .givenReducer(reducer, [firstVar, secondVar])
            .whenActionIsDispatched(changePipelineVariableMetric({ newMetric: expectedSecondVar.pipelineAgg, index: 1 }))
            .thenStateShouldEqual([firstVar, expectedSecondVar]);
    });
    it('Should not change state with other action types', function () {
        var initialState = [
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