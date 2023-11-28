import { Block, Document, Text, Value } from 'slate';
export const SCHEMA = {
    document: {
        nodes: [
            {
                match: [{ type: 'paragraph' }, { type: 'code_block' }, { type: 'code_line' }],
            },
        ],
    },
    inlines: {},
};
export const makeFragment = (text, syntax) => {
    const lines = text.split('\n').map((line) => Block.create({
        type: 'code_line',
        nodes: [Text.create(line)],
    }));
    const block = Block.create({
        data: {
            syntax,
        },
        type: 'code_block',
        nodes: lines,
    });
    return Document.create({
        nodes: [block],
    });
};
export const makeValue = (text, syntax) => {
    const fragment = makeFragment(text, syntax);
    return Value.create({
        document: fragment,
    });
};
//# sourceMappingURL=slate.js.map