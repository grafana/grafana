'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var tslib_1 = require('tslib');
var getPluginId_1 = require('../../config/utils/getPluginId');
var pluginValidation_1 = require('../../config/utils/pluginValidation');
var env_1 = require('../../plugins/env');
var path = require('path');
var fs = require('fs');
// @ts-ignore
// import execa = require('execa');
var githubClient_1 = tslib_1.__importDefault(require('./githubClient'));
var resolveContentType = function(extension) {
  if (extension.startsWith('.')) {
    extension = extension.substr(1);
  }
  switch (extension) {
    case 'zip':
      return 'application/zip';
    case 'json':
      return 'application/json';
    case 'sha1':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
};
var GitHubRelease = /** @class */ (function() {
  function GitHubRelease(token, username, repository, releaseNotes, commitHash) {
    this.token = token;
    this.username = username;
    this.repository = repository;
    this.releaseNotes = releaseNotes;
    this.commitHash = commitHash;
    this.git = new githubClient_1.default({
      required: true,
      repo: repository,
    });
  }
  GitHubRelease.prototype.publishAssets = function(srcLocation, destUrl) {
    var _this = this;
    // Add the assets. Loop through files in the ci/dist folder and upload each asset.
    var files = fs.readdirSync(srcLocation);
    return files.map(function(file) {
      return tslib_1.__awaiter(_this, void 0, void 0, function() {
        var fileStat, fileData;
        return tslib_1.__generator(this, function(_a) {
          fileStat = fs.statSync(srcLocation + '/' + file);
          fileData = fs.readFileSync(srcLocation + '/' + file);
          return [
            2 /*return*/,
            this.git.client.post(destUrl + '?name=' + file, fileData, {
              headers: {
                'Content-Type': resolveContentType(path.extname(file)),
                'Content-Length': fileStat.size,
              },
              maxContentLength: fileStat.size * 2 * 1024 * 1024,
            }),
          ];
        });
      });
    });
  };
  GitHubRelease.prototype.release = function() {
    var _a, _b, _c, _d;
    return tslib_1.__awaiter(this, void 0, void 0, function() {
      var ciDir,
        distDir,
        distContentDir,
        pluginJsonFile,
        pluginInfo,
        PUBLISH_DIR,
        commitHash,
        latestRelease,
        reason_1,
        newReleaseResponse,
        publishPromises,
        reason_2;
      return tslib_1.__generator(this, function(_e) {
        switch (_e.label) {
          case 0:
            ciDir = env_1.getCiFolder();
            distDir = path.resolve(ciDir, 'dist');
            distContentDir = path.resolve(distDir, getPluginId_1.getPluginId());
            pluginJsonFile = path.resolve(distContentDir, 'plugin.json');
            pluginInfo = pluginValidation_1.getPluginJson(pluginJsonFile).info;
            PUBLISH_DIR = path.resolve(env_1.getCiFolder(), 'packages');
            commitHash = this.commitHash || ((_a = pluginInfo.build) === null || _a === void 0 ? void 0 : _a.hash);
            _e.label = 1;
          case 1:
            _e.trys.push([1, 5, , 6]);
            return [4 /*yield*/, this.git.client.get('releases/tags/v' + pluginInfo.version)];
          case 2:
            latestRelease = _e.sent();
            if (!(latestRelease.data.tag_name === 'v' + pluginInfo.version)) {
              return [3 /*break*/, 4];
            }
            return [4 /*yield*/, this.git.client.delete('releases/' + latestRelease.data.id)];
          case 3:
            _e.sent();
            _e.label = 4;
          case 4:
            return [3 /*break*/, 6];
          case 5:
            reason_1 = _e.sent();
            if (reason_1.response.status !== 404) {
              // 404 just means no release found. Not an error. Anything else though, re throw the error
              throw reason_1;
            }
            return [3 /*break*/, 6];
          case 6:
            _e.trys.push([6, 9, , 10]);
            return [
              4 /*yield*/,
              this.git.client.post('releases', {
                tag_name: 'v' + pluginInfo.version,
                target_commitish: commitHash,
                name: 'v' + pluginInfo.version,
                body: this.releaseNotes,
                draft: false,
                prerelease: false,
              }),
            ];
          case 7:
            newReleaseResponse = _e.sent();
            publishPromises = this.publishAssets(
              PUBLISH_DIR,
              'https://uploads.github.com/repos/' +
                this.username +
                '/' +
                this.repository +
                '/releases/' +
                newReleaseResponse.data.id +
                '/assets'
            );
            return [4 /*yield*/, Promise.all(publishPromises)];
          case 8:
            _e.sent();
            return [3 /*break*/, 10];
          case 9:
            reason_2 = _e.sent();
            console.log(reason_2);
            // Rethrow the error so that we can trigger a non-zero exit code to circle-ci
            throw reason_2;
          case 10:
            return [2 /*return*/];
        }
      });
    });
  };
  return GitHubRelease;
})();
exports.GitHubRelease = GitHubRelease;
//# sourceMappingURL=githubRelease.js.map7027e10521e9
