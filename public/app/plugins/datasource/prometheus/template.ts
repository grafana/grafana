///<reference path="../../../headers/common.d.ts" />

export function renderTemplate(aliasPattern, aliasData) {
  var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
  return aliasPattern.replace(aliasRegex, function(match, g1) {
    if (aliasData[g1]) {
      return aliasData[g1];
    }
    return g1;
  });
}

