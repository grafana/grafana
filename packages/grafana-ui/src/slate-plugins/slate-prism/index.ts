import Prism from 'prismjs';
import { Block, Text, Decoration } from 'slate';
import { Plugin } from '@grafana/slate-react';
import Options, { OptionsFormat } from './options';
import TOKEN_MARK from './TOKEN_MARK';

/**
 * A Slate plugin to highlight code syntax.
 */
export function SlatePrism(optsParam: OptionsFormat = {}): Plugin {
  const opts: Options = new Options(optsParam);

  return {
    decorateNode: (node, editor, next) => {
      if (!opts.onlyIn(node)) {
        return next();
      }
      return decorateNode(opts, Block.create(node as Block));
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
function decorateNode(opts: Options, block: Block) {
  const grammarName = opts.getSyntax(block);
  const grammar = Prism.languages[grammarName];
  if (!grammar) {
    // Grammar not loaded
    return [];
  }

  // Tokenize the whole block text
  const texts = block.getTexts();
  const blockText = texts.map(text => text && text.getText()).join('\n');
  const tokens = Prism.tokenize(blockText, grammar);

  // The list of decorations to return
  const decorations: Decoration[] = [];
  let textStart = 0;
  let textEnd = 0;

  texts.forEach(text => {
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
        accu = `${accu} ${token.type} ${token.alias || ''}`;

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
