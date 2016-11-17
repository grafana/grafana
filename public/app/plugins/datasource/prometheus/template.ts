///<reference path="../../../headers/common.d.ts" />

const tStr = '(?:"([^"]*)")';
const tVar = '([_a-zA-Z0-9]+)';
const tExpr = '(?:' + tStr + '|' + tVar + ')';
const tArgList = tExpr + '(?:\\s*,\\s*' + tExpr + ')*';
const tPipe = '\\s*\\|\\s*(\\w+)\\s*\\(\\s*(' + tArgList + ')?\\s*,?\\s*\\)\\s*';

const functions = {
  replace: function(val, what, to) {
    return val.replace(new RegExp(what, 'g'), to);
  },
  toPercent: function(val) {
    return Math.round(parseFloat(val)*100) + '%';
  },
};

function expand(val, aliasData) {
  const ma = val.match(tStr);
  if (ma) {
    return ma[1];
  }

  if (aliasData[val]) {
    return aliasData[val];
  }

  return val;
}

function splitArgs(input) {
  var matches;
  const regex = new RegExp('(' + tExpr + ')\s*,?\s*', 'g');
  var ret = [];
  while ((matches = regex.exec(input)) !== null) {
    ret.push(matches[1]);
  }
  return ret;
}

function renderPipe(pipe, aliasData) {
  var result = expand(pipe[1], aliasData);
  const inputExpression = pipe[0];
  const regex = new RegExp(tPipe, 'g');
  var matches;
  while ((matches = regex.exec(inputExpression)) !== null) {
    const functionName = matches[1];
    const args = splitArgs(matches[2]);
    var forFunc = [ result ];
    for (const arg of args) {
      forFunc.push(expand(arg, aliasData));
    }

    const func = functions[functionName];
    result = func.apply(func, forFunc);
  }
  return result;
}

export function renderTemplate(aliasPattern, aliasData) {
  const pipeRegex = '^(' + tExpr + ')(?:' + tPipe + ')*$';

  var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
  return aliasPattern.replace(aliasRegex, function(match, g1) {
    const asPipe = g1.match(pipeRegex);
    if (asPipe) {
      return renderPipe(asPipe, aliasData);
    }

    if (aliasData[g1]) {
      return aliasData[g1];
    }
    return g1;
  });
}

