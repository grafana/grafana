type SerializedLiveField = {
  values?: unknown[];
  [key: string]: unknown;
};

type SerializedLiveFrame = {
  fields: SerializedLiveField[];
  refId?: string;
  [key: string]: unknown;
};

export type LiveMathExpression = {
  sourceRefId: string;
  resultRefId: string;
  expression: string;
};

type Token = { kind: 'number' | 'identifier' | 'variable' | 'operator'; value: string } | { kind: 'paren' | 'comma'; value: '(' | ')' | ',' };

const refs = /\$(?:\{([^}]+)\}|([A-Za-z_][A-Za-z0-9_]*))/g;

export function referencedRefIds(expression: string): string[] {
  const result = new Set<string>();
  for (const match of expression.matchAll(refs)) {
    result.add(match[1] ?? match[2]);
  }
  return [...result];
}

function tokenize(expression: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    if (/\s/.test(expression[i])) {
      i++;
      continue;
    }
    const variable = expression.slice(i).match(/^\$(?:\{([^}]+)\}|([A-Za-z_][A-Za-z0-9_]*))/);
    if (variable) {
      out.push({ kind: 'variable', value: variable[1] ?? variable[2] });
      i += variable[0].length;
      continue;
    }
    const number = expression.slice(i).match(/^(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/);
    if (number) {
      out.push({ kind: 'number', value: number[0] });
      i += number[0].length;
      continue;
    }
    const identifier = expression.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      out.push({ kind: 'identifier', value: identifier[0] });
      i += identifier[0].length;
      continue;
    }
    const op = expression.slice(i).match(/^(?:\*\*|>=|<=|==|!=|&&|\|\||[+\-*/%<>()!,])/);
    if (!op) {
      throw new Error(`unsupported character ${expression[i]}`);
    }
    const value = op[0];
    out.push(value === '(' || value === ')' ? { kind: 'paren', value } : value === ',' ? { kind: 'comma', value } : { kind: 'operator', value });
    i += value.length;
  }
  return out;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[], private readonly value: unknown) {}
  parse() {
    const result = this.logicalOr();
    if (this.index !== this.tokens.length) {
      throw new Error(`unexpected token ${this.tokens[this.index].value}`);
    }
    return result;
  }
  private peek(value: string) { return this.tokens[this.index]?.value === value; }
  private take(value: string) { if (this.peek(value)) { this.index++; return true; } return false; }
  private number(v: unknown) { return v == null ? NaN : Number(v); }
  private truthy(v: unknown) { return v != null && v !== false && Number(v) !== 0 && !Number.isNaN(Number(v)); }
  private logicalOr() {
    let v = this.logicalAnd();
    while (this.take('||')) {
      const r = this.logicalAnd();
      v = this.truthy(v) || this.truthy(r) ? 1 : 0;
    }
    return v;
  }
  private logicalAnd() {
    let v = this.equality();
    while (this.take('&&')) {
      const r = this.equality();
      v = this.truthy(v) && this.truthy(r) ? 1 : 0;
    }
    return v;
  }
  private equality() { let v = this.relational(); while (this.peek('==') || this.peek('!=')) { const op = this.tokens[this.index++].value; const r = this.relational(); v = op === '==' ? (v === r ? 1 : 0) : (v !== r ? 1 : 0); } return v; }
  private relational() { let v = this.additive(); while (this.peek('<') || this.peek('>') || this.peek('<=') || this.peek('>=')) { const op = this.tokens[this.index++].value; const a = this.number(v), b = this.number(this.additive()); v = op === '<' ? (a < b ? 1 : 0) : op === '>' ? (a > b ? 1 : 0) : op === '<=' ? (a <= b ? 1 : 0) : (a >= b ? 1 : 0); } return v; }
  private additive() { let v = this.multiplicative(); while (this.peek('+') || this.peek('-')) { const op = this.tokens[this.index++].value; const r = this.number(this.multiplicative()); v = op === '+' ? this.number(v) + r : this.number(v) - r; } return v; }
  private multiplicative() { let v = this.power(); while (this.peek('*') || this.peek('/') || this.peek('%')) { const op = this.tokens[this.index++].value; const a = this.number(v), b = this.number(this.power()); v = op === '*' ? a * b : op === '/' ? a / b : a % b; } return v; }
  private power() { const v = this.unary(); return this.take('**') ? Math.pow(this.number(v), this.number(this.power())) : v; }
  private unary() { if (this.take('!')) {return this.truthy(this.unary()) ? 0 : 1;} if (this.take('-')) {return -this.number(this.unary());} if (this.take('+')) {return this.number(this.unary());} return this.primary(); }
  private primary(): unknown {
    const token = this.tokens[this.index++];
    if (!token) {throw new Error('unexpected end of expression');}
    if (token.kind === 'number') {return token.value.startsWith(('0x')) || token.value.startsWith('0X') ? Number.parseInt(token.value, 16) : Number(token.value);}
    if (token.kind === 'variable') {return this.value;}
    if (token.kind === 'paren' && token.value === '(') { const v = this.logicalOr(); if (!this.take(')')) {throw new Error('missing closing parenthesis');} return v; }
    if (token.kind === 'identifier') {
      if (!this.take('(')) {throw new Error(`unknown identifier ${token.value}`);}
      const args: unknown[] = [];
      if (!this.peek(')')) { do {args.push(this.logicalOr());} while (this.take(',')); }
      if (!this.take(')')) {throw new Error(`missing closing parenthesis for ${token.value}`);}
      const n = (x = args[0]) => this.number(x);
      switch (token.value) {
        case 'abs': return Math.abs(n()); case 'ceil': return Math.ceil(n()); case 'floor': return Math.floor(n()); case 'round': return Math.round(n());
        case 'exp': return Math.exp(n()); case 'log': return Math.log(n()); case 'log10': return Math.log10(n()); case 'sqrt': return Math.sqrt(n());
        case 'sin': return Math.sin(n()); case 'cos': return Math.cos(n()); case 'tan': return Math.tan(n()); case 'pow': return Math.pow(n(), this.number(args[1]));
        case 'min': return Math.min(...args.map((v) => n(v))); case 'max': return Math.max(...args.map((v) => n(v)));
        case 'is_inf': return typeof args[0] === 'number' && Number.isFinite(args[0]) === false && Number.isNaN(args[0]) === false ? 1 : 0;
        case 'is_nan': return typeof args[0] === 'number' && Number.isNaN(args[0]) ? 1 : 0; case 'is_null': return args[0] == null ? 1 : 0;
        case 'is_number': return typeof args[0] === 'number' && Number.isFinite(args[0]) ? 1 : 0; case 'inf': return Infinity; case 'infn': return -Infinity; case 'nan': return NaN; case 'null': return null;
        default: throw new Error(`unsupported live math function ${token.value}`);
      }
    }
    throw new Error(`unexpected token ${token.value}`);
  }
}

export function createLiveMathTransform(expression: LiveMathExpression, fieldIndexes: number[]) {
  const tokens = tokenize(expression.expression);
  const evaluate = (value: unknown) => new Parser(tokens, value).parse();
  const values = (input: unknown[][]) => input.map((column, index) => fieldIndexes.includes(index) ? column.map(evaluate) : column);
  return {
    frame: (input: SerializedLiveFrame): SerializedLiveFrame => ({
      ...input,
      refId: expression.resultRefId,
      fields: input.fields.map((field, index) =>
        fieldIndexes.includes(index) ? { ...field, values: field.values?.map(evaluate) } : field
      ),
    }),
    values,
  };
}
