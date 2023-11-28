import { __awaiter } from "tslib";
import { CompletionProvider } from './autocomplete';
describe('CompletionProvider', () => {
    it('suggests labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = setup('{}', 1, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'foo', insertText: 'foo' }),
        ]);
    }));
    it('suggests label names with quotes', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = setup('{foo=}', 6, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'bar', insertText: '"bar"' }),
        ]);
    }));
    it('suggests label names without quotes', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = setup('{foo="}', 7, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'bar', insertText: 'bar' }),
        ]);
    }));
    it('suggests nothing without labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = setup('{foo="}', 7, []);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([]);
    }));
    it('suggests labels on empty input', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = setup('', 0, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'foo', insertText: '{foo="' }),
        ]);
    }));
});
const defaultLabels = ['foo'];
function setup(value, offset, labels = []) {
    const provider = new CompletionProvider();
    provider.init(labels, (label) => {
        if (labels.length === 0) {
            return Promise.resolve([]);
        }
        const val = { foo: 'bar' }[label];
        const result = [];
        if (val) {
            result.push(val);
        }
        return Promise.resolve(result);
    });
    const model = makeModel(value, offset);
    provider.monaco = {
        Range: {
            fromPositions() {
                return null;
            },
        },
        languages: {
            CompletionItemKind: {
                Enum: 1,
                EnumMember: 2,
            },
        },
    };
    provider.editor = {
        getModel() {
            return model;
        },
    };
    return { provider, model };
}
function makeModel(value, offset) {
    return {
        id: 'test_monaco',
        getWordAtPosition() {
            return null;
        },
        getOffsetAt() {
            return offset;
        },
        getValue() {
            return value;
        },
    };
}
//# sourceMappingURL=autocomplete.test.js.map