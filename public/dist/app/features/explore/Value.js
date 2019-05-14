import { Block, Document, Text, Value } from 'slate';
var SCHEMA = {
    blocks: {
        paragraph: 'paragraph',
        codeblock: 'code_block',
        codeline: 'code_line',
    },
    inlines: {},
    marks: {},
};
export var makeFragment = function (text, syntax) {
    var lines = text.split('\n').map(function (line) {
        return Block.create({
            type: 'code_line',
            nodes: [Text.create(line)],
        });
    });
    var block = Block.create({
        data: {
            syntax: syntax,
        },
        type: 'code_block',
        nodes: lines,
    });
    return Document.create({
        nodes: [block],
    });
};
export var makeValue = function (text, syntax) {
    var fragment = makeFragment(text, syntax);
    return Value.create({
        document: fragment,
        SCHEMA: SCHEMA,
    });
};
//# sourceMappingURL=Value.js.map