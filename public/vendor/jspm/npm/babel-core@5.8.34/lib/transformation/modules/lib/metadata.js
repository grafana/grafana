/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.ExportDeclaration = ExportDeclaration;
exports.Scope = Scope;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashObjectExtend = require("lodash/object/extend");

var _lodashObjectExtend2 = _interopRequireDefault(_lodashObjectExtend);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var ModuleDeclaration = {
  enter: function enter(node, parent, scope, formatter) {
    if (node.source) {
      node.source.value = formatter.file.resolveModuleSource(node.source.value);
      formatter.addScope(this);
    }
  }
};

exports.ModuleDeclaration = ModuleDeclaration;
/**
 * [Please add a description.]
 */

var ImportDeclaration = {
  exit: function exit(node, parent, scope, formatter) {
    formatter.hasLocalImports = true;

    var specifiers = [];
    var imported = [];
    formatter.metadata.imports.push({
      source: node.source.value,
      imported: imported,
      specifiers: specifiers
    });

    var _arr = this.get("specifiers");

    for (var _i = 0; _i < _arr.length; _i++) {
      var specifier = _arr[_i];
      var ids = specifier.getBindingIdentifiers();
      _lodashObjectExtend2["default"](formatter.localImports, ids);

      var local = specifier.node.local.name;

      if (specifier.isImportDefaultSpecifier()) {
        imported.push("default");
        specifiers.push({
          kind: "named",
          imported: "default",
          local: local
        });
      }

      if (specifier.isImportSpecifier()) {
        var importedName = specifier.node.imported.name;
        imported.push(importedName);
        specifiers.push({
          kind: "named",
          imported: importedName,
          local: local
        });
      }

      if (specifier.isImportNamespaceSpecifier()) {
        imported.push("*");
        specifiers.push({
          kind: "namespace",
          local: local
        });
      }
    }
  }
};

exports.ImportDeclaration = ImportDeclaration;
/**
 * [Please add a description.]
 */

function ExportDeclaration(node, parent, scope, formatter) {
  formatter.hasLocalExports = true;

  var source = node.source ? node.source.value : null;
  var exports = formatter.metadata.exports;

  // export function foo() {}
  // export var foo = "bar";
  var declar = this.get("declaration");
  if (declar.isStatement()) {
    var bindings = declar.getBindingIdentifiers();

    for (var name in bindings) {
      var binding = bindings[name];
      formatter._addExport(name, binding);

      exports.exported.push(name);
      exports.specifiers.push({
        kind: "local",
        local: name,
        exported: this.isExportDefaultDeclaration() ? "default" : name
      });
    }
  }

  if (this.isExportNamedDeclaration() && node.specifiers) {
    var _arr2 = node.specifiers;

    for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
      var specifier = _arr2[_i2];
      var exported = specifier.exported.name;
      exports.exported.push(exported);

      // export foo from "bar";
      if (t.isExportDefaultSpecifier(specifier)) {
        exports.specifiers.push({
          kind: "external",
          local: exported,
          exported: exported,
          source: source
        });
      }

      // export * as foo from "bar";
      if (t.isExportNamespaceSpecifier(specifier)) {
        exports.specifiers.push({
          kind: "external-namespace",
          exported: exported,
          source: source
        });
      }

      var local = specifier.local;
      if (!local) continue;

      formatter._addExport(local.name, specifier.exported);

      // export { foo } from "bar";
      // export { foo as bar } from "bar";
      if (source) {
        exports.specifiers.push({
          kind: "external",
          local: local.name,
          exported: exported,
          source: source
        });
      }

      // export { foo };
      // export { foo as bar };
      if (!source) {
        exports.specifiers.push({
          kind: "local",
          local: local.name,
          exported: exported
        });
      }
    }
  }

  // export * from "bar";
  if (this.isExportAllDeclaration()) {
    exports.specifiers.push({
      kind: "external-all",
      source: source
    });
  }

  if (!t.isExportDefaultDeclaration(node) && !declar.isTypeAlias()) {
    var onlyDefault = node.specifiers && node.specifiers.length === 1 && t.isSpecifierDefault(node.specifiers[0]);
    if (!onlyDefault) {
      formatter.hasNonDefaultExports = true;
    }
  }
}

/**
 * [Please add a description.]
 */

function Scope(node, parent, scope, formatter) {
  if (!formatter.isLoose()) {
    this.skip();
  }
}