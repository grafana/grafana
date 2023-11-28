import { __awaiter } from "tslib";
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { EmbeddedScene, SceneGridLayout, SceneGridRow, SceneTimeRange, SceneVariableSet, TestVariable, VizPanel, } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { activateFullSceneTree } from '../utils/test-utils';
import { PanelRepeaterGridItem } from './PanelRepeaterGridItem';
setPluginImportUtils({
    importPanelPlugin: (id) => Promise.resolve(getPanelPlugin({})),
    getPanelPluginFromCache: (id) => undefined,
});
describe('PanelRepeaterGridItem', () => {
    it('Given scene with variable with 2 values', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const { scene, repeater } = buildScene({ variableQueryTime: 0 });
        activateFullSceneTree(scene);
        expect((_a = repeater.state.repeatedPanels) === null || _a === void 0 ? void 0 : _a.length).toBe(5);
        const panel1 = repeater.state.repeatedPanels[0];
        const panel2 = repeater.state.repeatedPanels[1];
        // Panels should have scoped variables
        expect((_b = panel1.state.$variables) === null || _b === void 0 ? void 0 : _b.state.variables[0].getValue()).toBe('1');
        expect((_e = (_c = panel1.state.$variables) === null || _c === void 0 ? void 0 : (_d = _c.state.variables[0]).getValueText) === null || _e === void 0 ? void 0 : _e.call(_d)).toBe('A');
        expect((_f = panel2.state.$variables) === null || _f === void 0 ? void 0 : _f.state.variables[0].getValue()).toBe('2');
    }));
    it('Should wait for variable to load', () => __awaiter(void 0, void 0, void 0, function* () {
        var _g, _h;
        const { scene, repeater } = buildScene({ variableQueryTime: 1 });
        activateFullSceneTree(scene);
        expect((_g = repeater.state.repeatedPanels) === null || _g === void 0 ? void 0 : _g.length).toBe(0);
        yield new Promise((r) => setTimeout(r, 10));
        expect((_h = repeater.state.repeatedPanels) === null || _h === void 0 ? void 0 : _h.length).toBe(5);
    }));
    it('Should adjust container height to fit panels direction is horizontal', () => __awaiter(void 0, void 0, void 0, function* () {
        const { scene, repeater } = buildScene({ variableQueryTime: 0, maxPerRow: 2, itemHeight: 10 });
        const layoutForceRender = jest.fn();
        scene.state.body.forceRender = layoutForceRender;
        activateFullSceneTree(scene);
        // panels require 3 rows so total height should be 30
        expect(repeater.state.height).toBe(30);
        // Should update layout state by force re-render
        expect(layoutForceRender.mock.calls.length).toBe(1);
    }));
    it('Should adjust container height to fit panels when direction is vertical', () => __awaiter(void 0, void 0, void 0, function* () {
        const { scene, repeater } = buildScene({ variableQueryTime: 0, itemHeight: 10, repeatDirection: 'v' });
        activateFullSceneTree(scene);
        // In vertical direction height itemCount * itemHeight
        expect(repeater.state.height).toBe(50);
    }));
    it('Should adjust itemHeight when container is resized, direction horizontal', () => __awaiter(void 0, void 0, void 0, function* () {
        const { scene, repeater } = buildScene({
            variableQueryTime: 0,
            itemHeight: 10,
            repeatDirection: 'h',
            maxPerRow: 4,
        });
        activateFullSceneTree(scene);
        // Sould be two rows (5 panels and maxPerRow 5)
        expect(repeater.state.height).toBe(20);
        // resize container
        repeater.setState({ height: 10 });
        // given 2 current rows, the itemHeight is halved
        expect(repeater.state.itemHeight).toBe(5);
    }));
    it('Should adjust itemHeight when container is resized, direction vertical', () => __awaiter(void 0, void 0, void 0, function* () {
        const { scene, repeater } = buildScene({
            variableQueryTime: 0,
            itemHeight: 10,
            repeatDirection: 'v',
        });
        activateFullSceneTree(scene);
        // In vertical direction height itemCount * itemHeight
        expect(repeater.state.height).toBe(50);
        // resize container
        repeater.setState({ height: 25 });
        // given 5 rows with total height 25 gives new itemHeight of 5
        expect(repeater.state.itemHeight).toBe(5);
    }));
    it('When updating variable should update repeats', () => __awaiter(void 0, void 0, void 0, function* () {
        var _j;
        const { scene, repeater, variable } = buildScene({ variableQueryTime: 0 });
        activateFullSceneTree(scene);
        variable.changeValueTo(['1', '3'], ['A', 'C']);
        expect((_j = repeater.state.repeatedPanels) === null || _j === void 0 ? void 0 : _j.length).toBe(2);
    }));
});
function buildScene(options) {
    const repeater = new PanelRepeaterGridItem({
        variableName: 'server',
        repeatedPanels: [],
        repeatDirection: options.repeatDirection,
        maxPerRow: options.maxPerRow,
        itemHeight: options.itemHeight,
        source: new VizPanel({
            title: 'Panel $server',
            pluginId: 'timeseries',
        }),
    });
    const variable = new TestVariable({
        name: 'server',
        query: 'A.*',
        value: ALL_VARIABLE_VALUE,
        text: ALL_VARIABLE_TEXT,
        isMulti: true,
        includeAll: true,
        delayMs: options.variableQueryTime,
        optionsToReturn: [
            { label: 'A', value: '1' },
            { label: 'B', value: '2' },
            { label: 'C', value: '3' },
            { label: 'D', value: '4' },
            { label: 'E', value: '5' },
        ],
    });
    const scene = new EmbeddedScene({
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        $variables: new SceneVariableSet({
            variables: [variable],
        }),
        body: new SceneGridLayout({
            children: [
                new SceneGridRow({
                    children: [repeater],
                }),
            ],
        }),
    });
    return { scene, repeater, variable };
}
//# sourceMappingURL=PanelRepeaterGridItem.test.js.map