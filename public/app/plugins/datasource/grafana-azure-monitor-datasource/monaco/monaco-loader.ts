// tslint:disable:no-reference
// ///<reference path="../../../../../../node_modules/@kusto/monaco-kusto/release/min/monaco.d.ts" />

// (1) Desired editor features:
import "monaco-editor/esm/vs/editor/browser/controller/coreCommands.js";
import 'monaco-editor/esm/vs/editor/browser/widget/codeEditorWidget.js';
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/contextmenu.js';
import "monaco-editor/esm/vs/editor/contrib/find/findController.js";
import 'monaco-editor/esm/vs/editor/contrib/folding/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/format/formatActions.js';
import 'monaco-editor/esm/vs/editor/contrib/multicursor/multicursor.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/wordHighlighter.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js';
import "monaco-editor/esm/vs/editor/editor.api.js";

// (2) Desired languages:
import '@kusto/monaco-kusto/release/webpack/bridge.min.js';
import '@kusto/monaco-kusto/release/webpack/Kusto.JavaScript.Client.min.js';
import '@kusto/monaco-kusto/release/webpack/Kusto.Language.Bridge.min.js';
import '@kusto/monaco-kusto/release/webpack/monaco.contribution.min.js';
