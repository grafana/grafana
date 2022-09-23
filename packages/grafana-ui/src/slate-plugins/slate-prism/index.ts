import Prism, { LanguageMap } from 'prismjs';
import { Block, Text, Decoration } from 'slate';
import { Plugin } from 'slate-react';

import TOKEN_MARK from './TOKEN_MARK';
import Options, { OptionsFormat } from './options';

export interface Token {
  content: string;
  offsets?: {
    start: number;
    end: number;
  };
  types: string[];
  aliases: string[];
  prev?: Token | null;
  next?: Token | null;
}

/**
 * A Slate plugin to highlight code syntax.
 */
export function SlatePrism(optsParam: OptionsFormat = {}, prismLanguages = Prism.languages as LanguageMap): Plugin {
  const opts: Options = new Options(optsParam);

  return {
    decorateNode: (node, editor, next) => {
      if (!opts.onlyIn(node)) {
        return next();
      }

      const block = Block.create(node as Block);
      const grammarName = opts.getSyntax(block);
      const grammar = prismLanguages[grammarName];

      if (!grammar) {
        // Grammar not loaded
        return [];
      }

      // Tokenize the whole block text
      const texts = block.getTexts();
      const blockText = texts.map((text) => text && text.getText()).join('\n');
      const tokens = Prism.tokenize(blockText, grammar);
      const flattened = flattenTokens(tokens);

      const newData = editor.value.data.set('tokens', flattened);
      editor.setData(newData);
      return decorateNode(opts, tokens, block);
    },

    renderDecoration: (props, editor, next) =>
      opts.renderDecoration(
        {
          children: props.children,
          decoration: props.decoration,
        },
        editor as any,
        next
      ),
  };
}

/**
 * Returns the decoration for a node
 */
function decorateNode(opts: Options, tokens: Array<string | Prism.Token>, block: Block) {
  const texts = block.getTexts();

  // The list of decorations to return
  const decorations: Decoration[] = [];
  let textStart = 0;
  let textEnd = 0;

  texts.forEach((text) => {
    textEnd = textStart + text!.getText().length;

    let offset = 0;
    function processToken(token: string | Prism.Token, accu?: string | number) {
      if (typeof token === 'string') {
        if (accu) {
          const decoration = createDecoration({
            text: text!,
            textStart,
            textEnd,
            start: offset,
            end: offset + token.length,
            className: `prism-token token ${accu}`,
            block,
          });

          if (decoration) {
            decorations.push(decoration);
          }
        }
        offset += token.length;
      } else {
        accu = `${accu} ${token.type}`;
        if (token.alias) {
          accu += ' ' + token.alias;
        }

        if (typeof token.content === 'string') {
          const decoration = createDecoration({
            text: text!,
            textStart,
            textEnd,
            start: offset,
            end: offset + token.content.length,
            className: `prism-token token ${accu}`,
            block,
          });

          if (decoration) {
            decorations.push(decoration);
          }

          offset += token.content.length;
        } else {
          // When using token.content instead of token.matchedStr, token can be deep
          for (let i = 0; i < token.content.length; i += 1) {
            // @ts-ignore
            processToken(token.content[i], accu);
          }
        }
      }
    }

    tokens.forEach(processToken);
    textStart = textEnd + 1; // account for added `\n`
  });

  return decorations;
}

/**
 * Return a decoration range for the given text.
 */
function createDecoration({
  text,
  textStart,
  textEnd,
  start,
  end,
  className,
  block,
}: {
  text: Text; // The text being decorated
  textStart: number; // Its start position in the whole text
  textEnd: number; // Its end position in the whole text
  start: number; // The position in the whole text where the token starts
  end: number; // The position in the whole text where the token ends
  className: string; // The prism token classname
  block: Block;
}): Decoration | null {
  if (start >= textEnd || end <= textStart) {
    // Ignore, the token is not in the text
    return null;
  }

  // Shrink to this text boundaries
  start = Math.max(start, textStart);
  end = Math.min(end, textEnd);

  // Now shift offsets to be relative to this text
  start -= textStart;
  end -= textStart;

  const myDec = block.createDecoration({
    object: 'decoration',
    anchor: {
      key: text.key,
      offset: start,
      object: 'point',
    },
    focus: {
      key: text.key,
      offset: end,
      object: 'point',
    },
    type: TOKEN_MARK,
    data: { className },
  });

  return myDec;
}

function flattenToken(token: string | Prism.Token | Array<string | Prism.Token>): Token[] {
  if (typeof token === 'string') {
    return [
      {
        content: token,
        types: [],
        aliases: [],
      },
    ];
  } else if (Array.isArray(token)) {
    return token.flatMap((t) => flattenToken(t));
  } else if (token instanceof Prism.Token) {
    return flattenToken(token.content).flatMap((t) => {
      let aliases: string[] = [];
      if (typeof token.alias === 'string') {
        aliases = [token.alias];
      } else {
        aliases = token.alias ?? [];
      }

      return {
        content: t.content,
        types: [token.type, ...t.types],
        aliases: [...aliases, ...t.aliases],
      };
    });
  }

  return [];
}

export function flattenTokens(token: string | Prism.Token | Array<string | Prism.Token>) {
  const tokens = flattenToken(token);

  if (!tokens.length) {
    return [];
  }

  const firstToken = tokens[0];
  firstToken.prev = null;
  firstToken.next = tokens.length >= 2 ? tokens[1] : null;
  firstToken.offsets = {
    start: 0,
    end: firstToken.content.length,
  };

  for (let i = 1; i < tokens.length - 1; i++) {
    tokens[i].prev = tokens[i - 1];
    tokens[i].next = tokens[i + 1];

    tokens[i].offsets = {
      start: tokens[i - 1].offsets!.end,
      end: tokens[i - 1].offsets!.end + tokens[i].content.length,
    };
  }

  const lastToken = tokens[tokens.length - 1];
  lastToken.prev = tokens.length >= 2 ? tokens[tokens.length - 2] : null;
  lastToken.next = null;
  lastToken.offsets = {
    start: tokens.length >= 2 ? tokens[tokens.length - 2].offsets!.end : 0,
    end:
      tokens.length >= 2 ? tokens[tokens.length - 2].offsets!.end + lastToken.content.length : lastToken.content.length,
  };

  return tokens;
}
