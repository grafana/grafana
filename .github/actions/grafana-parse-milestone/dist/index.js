module.exports =
/******/ (function(modules, runtime) { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	__webpack_require__.ab = __dirname + "/";
/******/
/******/ 	// the startup function
/******/ 	function startup() {
/******/ 		// Load entry module and return exports
/******/ 		return __webpack_require__(931);
/******/ 	};
/******/
/******/ 	// run startup
/******/ 	return startup();
/******/ })
/************************************************************************/
/******/ ({

/***/ 1:
/***/ (function() {

eval("require")("@actions/github");


/***/ }),

/***/ 494:
/***/ (function() {

eval("require")("@actions/core");


/***/ }),

/***/ 931:
/***/ (function(__unusedmodule, __unusedexports, __webpack_require__) {

const core = __webpack_require__(494);
const github = __webpack_require__(1);

try {
  const milestone = github.context.payload.pull_request.milestone;

  if (!milestone) {
    core.setFailed('This pull request has no milestone assigned! Please assign an open milestone.');
    return;
  }

  console.log(`Milestone: ${milestone}!`);

  if (milestone.closed) {
    core.setFailed('Milestone ' + milestone.title + ' is closed! Please assign an open milestone.');
    return;
  }

  const versionPattern = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z\.]+))?/;
  const match = versionPattern.exec(milestone.title);
  if (!match) {
    core.setFailed('Could not parse Milestone title ' + milestone.title);
    return;
  }

  const major = Number(match[1]);
  const minor = Number(match[2] || 0);
  const patch = Number(match[3] || 0);
  const meta = match[4];

  core.setOutput('major', major.toString());
  core.setOutput('minor', minor.toString());
  core.setOutput('patch', patch.toString());
  core.setOutput('meta', meta.toString());
} catch (error) {
  core.setFailed(error.message);
}


/***/ })

/******/ });