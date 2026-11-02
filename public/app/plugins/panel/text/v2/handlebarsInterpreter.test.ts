import Handlebars from 'handlebars';

import { compileTemplate } from './handlebars';
import { interpret } from './handlebarsInterpreter';

function interpretTemplate(template: string, context: unknown) {
  const env = Handlebars.create();
  return interpret(env.parse(template), env)(context);
}

// Jest allows eval, so stock Handlebars is the reference.
function compileReference(template: string, context: unknown) {
  return Handlebars.create().compile(template)(context);
}

const items = { title: 'T', items: [{ name: 'a' }, { name: 'b' }] };

describe('interpret', () => {
  describe('matches the compiled template', () => {
    it.each([
      { name: 'plain content', template: 'plain', context: {}, expected: 'plain' },
      { name: 'an escaped value', template: '{{a}}', context: { a: '<b>&' }, expected: '&lt;b&gt;&amp;' },
      { name: 'a triple-stash value', template: '{{{a}}}', context: { a: '<b>' }, expected: '<b>' },
      { name: 'an ampersand value', template: '{{&a}}', context: { a: '<b>' }, expected: '<b>' },
      { name: 'a nested path', template: '{{a.b.c}}', context: { a: { b: { c: 1 } } }, expected: '1' },
      { name: 'a missing path', template: '[{{a.b}}]', context: {}, expected: '[]' },
      { name: 'a path through null', template: '[{{a.b}}]', context: { a: null }, expected: '[]' },
      { name: 'zero and false', template: '{{a}}|{{b}}', context: { a: 0, b: false }, expected: '0|false' },
      { name: 'an array value', template: '{{a}}', context: { a: [1, 2] }, expected: '1,2' },
      { name: 'an object value', template: '{{a}}', context: { a: {} }, expected: '[object Object]' },
      { name: 'the context itself', template: '{{this}}{{.}}', context: 'x', expected: 'xx' },
      { name: 'a string literal path', template: '{{"a b"}}', context: { 'a b': 'x' }, expected: 'x' },
      {
        name: 'a function value, called with the context',
        template: '{{fn}}',
        context: {
          v: 'L',
          fn(this: { v: string }): string {
            return this.v;
          },
        },
        expected: 'L',
      },
      {
        name: '#each over an array, with @index, @first and @last',
        template: '{{#each a}}{{@index}}:{{this}}{{#if @first}}F{{/if}}{{#if @last}}L{{/if}},{{/each}}',
        context: { a: ['x', 'y'] },
        expected: '0:xF,1:yL,',
      },
      {
        name: '#each over an object, with @key',
        template: '{{#each o}}{{@key}}={{this}};{{/each}}',
        context: { o: { p: 1, q: 2 } },
        expected: 'p=1;q=2;',
      },
      { name: '#each else', template: '{{#each a}}x{{else}}empty{{/each}}', context: { a: [] }, expected: 'empty' },
      {
        name: 'a parent path',
        template: '{{#each items}}{{name}}@{{../title}} {{/each}}',
        context: items,
        expected: 'a@T b@T ',
      },
      {
        name: 'a parent path that skips a block keeping its context',
        template: '{{#with a}}{{#if ok}}{{../b}}{{/if}}{{/with}}',
        context: { a: { ok: true }, b: 'root' },
        expected: 'root',
      },
      {
        name: 'a parent path that skips a block whose context loosely equals its parent',
        template: '{{#each a}}{{#each ../b}}[{{../this}}]{{/each}}{{/each}}',
        context: { a: [1], b: ['1'] },
        expected: '[[object Object]]',
      },
      {
        name: 'a parent path that skips a primitive equal to its single-item array',
        template: '{{#each a}}{{#each this}}[{{../this}}]{{/each}}{{/each}}',
        context: { a: [[0], ['']] },
        expected: '[[object Object]][[object Object]]',
      },
      {
        name: 'block params',
        template: '{{#each items as |item i|}}{{i}}={{item.name}} {{/each}}',
        context: items,
        expected: '0=a 1=b ',
      },
      {
        name: 'an outer block param read from a nested block',
        template: '{{#each rows as |row|}}{{#each row as |cell|}}{{row.length}}{{cell}}{{/each}}{{/each}}',
        context: { rows: [['a', 'b']] },
        expected: '2a2b',
      },
      {
        name: 'a parent @index',
        template: '{{#each rows}}{{#each this}}{{@../index}}.{{@index}} {{/each}}{{/each}}',
        context: { rows: [['a', 'b'], ['c']] },
        expected: '0.0 0.1 1.0 ',
      },
      {
        name: 'a block param shadowing a field',
        template: '{{#each items as |name|}}{{name.name}}{{/each}}',
        context: items,
        expected: 'ab',
      },
      {
        name: 'an else block, which does not see the block params',
        template: '{{#each items as |item|}}{{item.name}}{{else}}[{{item}}]{{/each}}',
        context: { items: [], item: 'outer' },
        expected: '[outer]',
      },
      {
        name: 'a function used as a section',
        template: '{{#ok}}yes{{/ok}}',
        context: {
          ok(): boolean {
            return true;
          },
        },
        expected: 'yes',
      },
      { name: '@root', template: '{{#each a}}{{@root.t}}{{/each}}', context: { a: [1], t: 'R' }, expected: 'R' },
      { name: '#with', template: '{{#with a}}{{b}}{{/with}}', context: { a: { b: 'x' } }, expected: 'x' },
      { name: '#with else', template: '{{#with a}}x{{else}}none{{/with}}', context: {}, expected: 'none' },
      {
        name: 'an else if chain',
        template: '{{#if a}}A{{else if b}}B{{else}}C{{/if}}',
        context: { b: 1 },
        expected: 'B',
      },
      { name: '#unless', template: '{{#unless a}}no{{/unless}}', context: {}, expected: 'no' },
      {
        name: '#if with includeZero',
        template: '{{#if n includeZero=true}}y{{else}}n{{/if}}',
        context: { n: 0 },
        expected: 'y',
      },
      { name: 'an inverted section', template: '{{^a}}none{{/a}}', context: {}, expected: 'none' },
      {
        name: 'a section over an array',
        template: '{{#a}}[{{this}}]{{/a}}',
        context: { a: [1, 2] },
        expected: '[1][2]',
      },
      { name: 'a section over an object', template: '{{#a}}{{b}}{{/a}}', context: { a: { b: 'x' } }, expected: 'x' },
      { name: 'a section over true', template: '{{#a}}yes{{/a}}', context: { a: true }, expected: 'yes' },
      { name: 'a scoped section', template: '{{#this.a}}{{b}}{{/this.a}}', context: { a: { b: 'x' } }, expected: 'x' },
      { name: 'lookup by index', template: '{{lookup a 1}}', context: { a: ['x', 'y'] }, expected: 'y' },
      { name: 'lookup by key', template: '{{lookup o k}}', context: { o: { z: 'v' }, k: 'z' }, expected: 'v' },
      {
        name: 'a subexpression',
        template: '{{#each (lookup this "a")}}{{this}}{{/each}}',
        context: { a: [1, 2] },
        expected: '12',
      },
      {
        name: 'whitespace control',
        template: '{{#each a~}}\n  {{this}}\n{{~/each}}',
        context: { a: [1, 2] },
        expected: '12',
      },
      { name: 'an escaped mustache', template: '\\{{a}}', context: { a: 1 }, expected: '{{a}}' },
      { name: 'comments', template: 'x{{! hi }}{{!-- {{a}} --}}y', context: { a: 1 }, expected: 'xy' },
      { name: 'a raw block with no helper', template: '{{{{raw}}}}{{a}}{{{{/raw}}}}', context: {}, expected: '' },
      { name: 'the length of a string', template: '{{#with "abc"}}{{length}}{{/with}}', context: {}, expected: '3' },
    ])('$name', ({ template, context, expected }) => {
      expect(compileReference(template, context)).toBe(expected);
      expect(interpretTemplate(template, context)).toBe(expected);
    });
  });

  // Stock Handlebars throws on these, so there is no reference to compare with.
  describe('gives inline partials the block params of where they are defined', () => {
    it.each([
      {
        name: 'a partial defined inside a loop, reading the loop block param',
        template: '{{#each a as |row|}}{{#*inline "p"}}[{{row.h}}]{{/inline}}{{> p}}{{/each}}',
        context: { a: [{ h: 'x' }, { h: 'y' }] },
        expected: '[x][y]',
      },
      {
        name: 'a partial named by a block param',
        template: '{{#each a as |row|}}{{#*inline row.n}}{{row.h}}{{/inline}}{{> p}}{{/each}}',
        context: { a: [{ n: 'p', h: 'x' }] },
        expected: 'x',
      },
    ])('$name', ({ template, context, expected }) => {
      expect(interpretTemplate(template, context)).toBe(expected);
    });
  });

  describe('renders inline partials the way the compiled template does', () => {
    it.each([
      {
        name: 'a partial with a context argument',
        template: '{{#*inline "row"}}Hello {{this}}{{/inline}}{{> row "Paul"}}',
        context: {},
        expected: 'Hello Paul',
      },
      {
        name: 'a partial defined after its use',
        template: '{{> p}}{{#*inline "p"}}hoisted{{/inline}}',
        context: {},
        expected: 'hoisted',
      },
      {
        name: 'a partial in a loop, with the caller data and the definition parents',
        template: '{{#*inline "p"}}[{{this}}|{{../t}}|{{@index}}]{{/inline}}{{#each a}}{{> p}}{{/each}}',
        context: { a: [1, 2], t: 'T' },
        expected: '[1||0][2||1]',
      },
      {
        name: 'a partial defined inside a loop',
        template: '{{#each a}}{{#*inline "p"}}[{{this}}|{{../t}}]{{/inline}}{{> p}}{{/each}}',
        context: { a: [1, 2], t: 'T' },
        expected: '[1|T][2|T]',
      },
      {
        name: 'hash arguments over the current or given context',
        template: '{{#*inline "p"}}{{x}}{{/inline}}{{> p x=2}}{{> p this x=3}}{{> p "s" x=4}}',
        context: { x: 1 },
        expected: '234',
      },
      {
        name: 'a partial calling another',
        template: '{{#*inline "p"}}{{> q}}{{/inline}}{{#*inline "q"}}Q{{/inline}}{{> p}}',
        context: {},
        expected: 'Q',
      },
      {
        name: 'an escaped value inside a partial',
        template: '{{#*inline "p"}}<{{this}}>{{/inline}}{{> p v}}',
        context: { v: '<b>' },
        expected: '<&lt;b&gt;>',
      },
      {
        name: 'a standalone partial, indented line by line',
        template: '{{#*inline "p"}}\n  a\n  b\n{{/inline}}\n<ul>\n  {{> p}}\n</ul>',
        context: {},
        expected: '<ul>\n    a\n    b\n</ul>',
      },
      {
        name: 'nested standalone partials, indented at each level',
        template: '{{#*inline "p"}}\n  {{> q}}\n{{/inline}}{{#*inline "q"}}x\ny\n{{/inline}}\n<div>\n  {{> p}}\n</div>',
        context: {},
        expected: '<div>\n    x\n    y\n</div>',
      },
      {
        name: 'a recursive partial',
        template: '{{#*inline "t"}}({{name}}{{#each children}}{{> t}}{{/each}}){{/inline}}{{> t}}',
        context: { name: 'a', children: [{ name: 'b', children: [{ name: 'c', children: [] }] }, { name: 'd' }] },
        expected: '(a(b(c))(d))',
      },
      {
        name: 'a redefined partial, where the last one wins',
        template: '{{#*inline "p"}}1{{/inline}}{{#*inline "p"}}2{{/inline}}{{> p}}',
        context: {},
        expected: '2',
      },
      {
        name: 'a partial shadowed inside a block, then restored',
        template: '{{#*inline "p"}}outer{{/inline}}{{#with a}}{{#*inline "p"}}inner{{/inline}}{{> p}}{{/with}}{{> p}}',
        context: { a: {} },
        expected: 'innerouter',
      },
      {
        name: 'a partial defined in an else block',
        template: '{{#if false}}x{{else}}{{#*inline "p"}}E{{/inline}}{{> p}}{{/if}}',
        context: {},
        expected: 'E',
      },
      {
        name: 'a partial named with a string literal',
        template: '{{#*inline "my row"}}S{{/inline}}{{> "my row"}}',
        context: {},
        expected: 'S',
      },
    ])('$name', ({ template, context, expected }) => {
      expect(compileReference(template, context)).toBe(expected);
      expect(interpretTemplate(template, context)).toBe(expected);
    });

    it('drops a block partial after a render that failed inside the block', () => {
      const env = Handlebars.create();
      const render = interpret(env.parse('{{#if fail}}{{#*inline "p"}}x{{/inline}}{{nope 1}}{{/if}}{{> p}}'), env);

      expect(() => render({ fail: true })).toThrow('Missing helper: "nope"');
      expect(() => render({ fail: false })).toThrow('The partial p could not be found');
    });
  });

  describe('denies prototype access the way the compiled template does', () => {
    // Stock Handlebars logs denied properties.
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      { name: 'a prototype method', template: '[{{a.toString}}]', context: { a: {} } },
      { name: 'constructor', template: '[{{constructor}}]', context: {} },
      { name: 'a constructor name', template: '[{{a.constructor.name}}]', context: { a: {} } },
      { name: '__proto__', template: '[{{__proto__}}]', context: {} },
      { name: 'constructor through lookup', template: '[{{lookup this "constructor"}}]', context: {} },
      {
        name: 'a string method reached through block params',
        template: '[{{#with "s" as |string|}}{{#with string.sub as |sub|}}{{sub.constructor}}{{/with}}{{/with}}]',
        context: {},
      },
      {
        name: 'the constructor of a looked-up constructor',
        template: '[{{#with (lookup this "constructor") as |c|}}{{c.constructor}}{{/with}}]',
        context: {},
      },
    ])('$name', ({ template, context }) => {
      expect(compileReference(template, context)).toBe('[]');
      expect(interpretTemplate(template, context)).toBe('[]');
    });
  });

  describe('throws the errors the compiled template does', () => {
    it.each([
      { name: 'an unknown helper', template: '{{nope a}}', message: 'Missing helper: "nope"' },
      { name: 'an unknown helper path', template: '{{a.b c}}', message: 'Missing helper: "a.b"' },
      { name: '#if without an argument', template: '{{#if}}x{{/if}}', message: '#if requires exactly one argument' },
      { name: 'an undefined partial', template: '{{> row}}', message: 'The partial row could not be found' },
      {
        name: 'a partial out of scope',
        template: '{{#if true}}{{#*inline "p"}}x{{/inline}}{{/if}}{{> p}}',
        message: 'The partial p could not be found',
      },
      {
        name: 'a partial with two arguments',
        template: '{{> p a b}}',
        message: 'Unsupported number of partial arguments: 2',
      },
    ])('$name', ({ template, message }) => {
      expect(() => compileReference(template, {})).toThrow(message);
      expect(() => interpretTemplate(template, {})).toThrow(message);
    });
  });

  it.each([
    { name: 'a dynamic partial', template: '{{#*inline "p"}}x{{/inline}}{{> (lookup . "n")}}' },
    { name: 'a partial block', template: '{{#*inline "p"}}x{{/inline}}{{#> p}}fallback{{/p}}' },
    { name: 'a decorator other than inline', template: '{{#*custom}}x{{/custom}}' },
  ])('throws on $name, which is unsupported', ({ template }) => {
    expect(() => interpretTemplate(template, { n: 'p' })).toThrow('Unsupported Handlebars expression');
  });

  it('renders without generating code, as under a CSP without unsafe-eval', () => {
    const blocked = jest.spyOn(global, 'Function').mockImplementation(() => {
      throw new EvalError('unsafe-eval is not allowed');
    });
    const template = '{{#each data}}{{toFixed cpu 1}} {{/each}}';
    const context = { data: [{ cpu: 0.84 }, { cpu: 0.12 }] };

    try {
      expect(compileTemplate(template, (value) => value)(context)).toBe('0.8 0.1 ');
      expect(() => compileReference(template, context)).toThrow('unsafe-eval is not allowed');
    } finally {
      blocked.mockRestore();
    }
  });
});
