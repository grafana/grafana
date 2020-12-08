import { create, all } from 'mathjs';

let mathjs: Partial<math.MathJsStatic> | undefined = undefined;

// Lazy load mathjs init
export function getMathJS(): math.MathJsStatic {
  if (!mathjs) {
    mathjs = create(all, {});
  }
  return mathjs as any;
}

export interface MathInfo {
  err?: any;
  symbols: string[];
  node: math.MathNode;
  eval: math.EvalFunction;
}

export function parseEquation(expr: string): MathInfo {
  const math = getMathJS();
  try {
    const symbols = new Set<string>();
    const node = math.parse(expr);
    node.traverse((n, path, parent) => {
      if (n.isSymbolNode && n.name && !parent.isFunctionNode) {
        symbols.add(n.name);
      }
    });
    return { node, symbols: Array.from(symbols), eval: node.compile() };
  } catch (err) {
    return ({ err, symbols: [] } as unknown) as MathInfo;
  }
}
