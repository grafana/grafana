// @ts-ignore
import { Block, Document, Text, Value } from 'slate';

const SCHEMA = {
  blocks: {
    paragraph: 'paragraph',
    codeblock: 'code_block',
    codeline: 'code_line',
  },
  inlines: {},
  marks: {},
};

export const makeFragment = (text: string, syntax?: string) => {
  const lines = text.split('\n').map(line =>
    Block.create({
      type: 'code_line',
      nodes: [Text.create(line)],
    } as any)
  );

  const block = Block.create({
    data: {
      syntax,
    },
    type: 'code_block',
    nodes: lines,
  } as any);

  return Document.create({
    nodes: [block],
  });
};

export const makeValue = (text: string, syntax?: string) => {
  const fragment = makeFragment(text, syntax);

  return Value.create({
    document: fragment,
    SCHEMA,
  } as any);
};
