"use strict";
exports.__esModule = true;
var rollup_plugin_node_resolve_1 = require("rollup-plugin-node-resolve");
var rollup_plugin_commonjs_1 = require("rollup-plugin-commonjs");
var rollup_plugin_sourcemaps_1 = require("rollup-plugin-sourcemaps");
var rollup_plugin_terser_1 = require("rollup-plugin-terser");
var pkg = require('./package.json');
var libraryName = pkg.name;
var buildCjsPackage = function (_a) {
    var env = _a.env;
    return {
        input: "compiled/index.js",
        output: [
            {
                file: "dist/index." + env + ".js",
                name: libraryName,
                format: 'cjs',
                sourcemap: true,
                exports: 'named',
                globals: {}
            },
        ],
        plugins: [
            rollup_plugin_commonjs_1["default"]({
                include: /node_modules/
            }),
            rollup_plugin_node_resolve_1["default"](),
            rollup_plugin_sourcemaps_1["default"](),
            env === 'production' && rollup_plugin_terser_1.terser(),
        ]
    };
};
exports["default"] = [buildCjsPackage({ env: 'development' }), buildCjsPackage({ env: 'production' })];
