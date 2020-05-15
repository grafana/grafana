const antlr4 = require('antlr4');
const ScrollQLLexer = require('./ScrollQLLexer').ScrollQLLexer;
const ScrollQLParser = require('./ScrollQLParser').ScrollQLParser;
const ScrollQLParserListener = require('./ScrollQLParserListener').ScrollQLParserListener;

class GroupListener extends ScrollQLParserListener {
  groupNames: string[] = [];

  enterLogStats(ctx: any) {
    this.groupNames = [];
    if (ctx.groups && ctx.groups.length > 0) {
      const groups = ctx.groups;

      groups.forEach((group: any) => {
        const proj = group.fieldSpec?.().proj;
        if (proj) {
          this.groupNames.push(proj.getText());
        } else {
          this.groupNames.push(group.getText());
        }
      });
    }
  }
}

export function getStatsGroups(text: string): string[] {
  const queryPrefix = 'source test start=0 end=1|';
  const queryText = queryPrefix + text;
  const chars = new antlr4.InputStream(queryText);
  const lexer = new ScrollQLLexer(chars);
  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new ScrollQLParser(tokens);
  parser.buildParseTrees = true;
  const tree = parser.query();
  const printer = new GroupListener();
  antlr4.tree.ParseTreeWalker.DEFAULT.walk(printer, tree);
  return printer.groupNames;
}
