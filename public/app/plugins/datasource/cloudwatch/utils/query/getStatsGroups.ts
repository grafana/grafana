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
        // This code is for handling the case where a field specifier is aliased, with the alias available via
        // the proj property. Otherwise we can just take the group text as it is.
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
  // Dummy prefix needed here for parser to function correctly
  const dummyPrefix = 'source test start=0 end=1|';
  const queryText = dummyPrefix + text;
  const chars = new antlr4.InputStream(queryText);
  const lexer = new ScrollQLLexer(chars);
  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new ScrollQLParser(tokens);
  parser.buildParseTrees = true;
  const tree = parser.query();
  const groupListener = new GroupListener();
  antlr4.tree.ParseTreeWalker.DEFAULT.walk(groupListener, tree);
  return groupListener.groupNames;
}
