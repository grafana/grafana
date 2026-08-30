import Prism from 'prismjs';

// Vendored from @grafana/ui/internal's slate-prism module: decoupled plugins can't depend on
// @grafana/ui/internal since it isn't registered as a shared module for the plugin SystemJS loader.
interface Token {
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
