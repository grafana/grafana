import { __awaiter } from "tslib";
import { CompletionProvider } from './autocomplete';
describe('CompletionProvider', () => {
    it('suggests labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = yield setup('{}', 1, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'foo', insertText: 'foo' }),
        ]);
    }));
    it('suggests label names with quotes', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = yield setup('{foo=}', 6, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'bar', insertText: '"bar"' }),
        ]);
    }));
    it('suggests label names without quotes', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = yield setup('{foo="}', 7, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'bar', insertText: 'bar' }),
        ]);
    }));
    it('suggests nothing without labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = yield setup('{foo="}', 7, {});
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([]);
    }));
    it('suggests labels on empty input', () => __awaiter(void 0, void 0, void 0, function* () {
        const { provider, model } = yield setup('', 0, defaultLabels);
        const result = yield provider.provideCompletionItems(model, {});
        expect(result.suggestions).toEqual([
            expect.objectContaining({ label: 'foo', insertText: '{foo="' }),
        ]);
    }));
});
const defaultLabels = { foo: ['bar'] };
const fakeMonaco = {
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
function makeFakeEditor(model) {
    return {
        getModel() {
            return model;
        },
    };
}
function setup(value, offset, labels) {
    return __awaiter(this, void 0, void 0, function* () {
        const model = makeModel(value, offset);
        const editor = makeFakeEditor(model);
        const provider = new CompletionProvider({
            getLabelNames() {
                return Promise.resolve(Object.keys(labels));
            },
            getLabelValues(label) {
                return Promise.resolve(labels[label]);
            },
        }, fakeMonaco, editor);
        yield provider.init();
        return { provider, model };
    });
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