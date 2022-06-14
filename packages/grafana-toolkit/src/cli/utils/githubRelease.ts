import { AxiosResponse } from 'axios';
import fs = require('fs');
import path = require('path');

import { getPluginId } from '../../config/utils/getPluginId';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { getCiFolder } from '../../plugins/env';

import GithubClient from './githubClient';

const resolveContentType = (extension: string): string => {
  if (extension.startsWith('.')) {
    extension = extension.slice(1);
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

class GitHubRelease {
  token: string;
  username: string;
  repository: string;
  releaseNotes: string;
  commitHash?: string;
  git: GithubClient;

  constructor(token: string, username: string, repository: string, releaseNotes: string, commitHash?: string) {
    this.token = token;
    this.username = username;
    this.repository = repository;
    this.releaseNotes = releaseNotes;
    this.commitHash = commitHash;

    this.git = new GithubClient({
      required: true,
      owner: username,
      repo: repository,
    });
  }

  publishAssets(srcLocation: string, destUrl: string) {
    // Add the assets. Loop through files in the ci/dist folder and upload each asset.
    const files = fs.readdirSync(srcLocation);

    return files.map(async (file: string) => {
      const fileStat = fs.statSync(`${srcLocation}/${file}`);
      const fileData = fs.readFileSync(`${srcLocation}/${file}`);
      return this.git.client.post(`${destUrl}?name=${file}`, fileData, {
        headers: {
          'Content-Type': resolveContentType(path.extname(file)),
          'Content-Length': fileStat.size,
        },
        maxContentLength: fileStat.size * 2 * 1024 * 1024,
      });
    });
  }

  async release() {
    const ciDir = getCiFolder();
    const distDir = path.resolve(ciDir, 'dist');
    const distContentDir = path.resolve(distDir, getPluginId());
    const pluginJsonFile = path.resolve(distContentDir, 'plugin.json');
    const pluginInfo = getPluginJson(pluginJsonFile).info;
    const PUBLISH_DIR = path.resolve(getCiFolder(), 'packages');
    const commitHash = this.commitHash || pluginInfo.build?.hash;

    try {
      const latestRelease: AxiosResponse<any> = await this.git.client.get(`releases/tags/v${pluginInfo.version}`);

      // Re-release if the version is the same as an existing release
      if (latestRelease.data.tag_name === `v${pluginInfo.version}`) {
        await this.git.client.delete(`releases/${latestRelease.data.id}`);
      }
    } catch (reason: any) {
      if (reason.response.status !== 404) {
        // 404 just means no release found. Not an error. Anything else though, re throw the error
        throw reason;
      }
    }

    try {
      // Now make the release
      const newReleaseResponse = await this.git.client.post('releases', {
        tag_name: `v${pluginInfo.version}`,
        target_commitish: commitHash,
        name: `v${pluginInfo.version}`,
        body: this.releaseNotes,
        draft: false,
        prerelease: false,
      });

      const publishPromises = this.publishAssets(
        PUBLISH_DIR,
        `https://uploads.github.com/repos/${this.username}/${this.repository}/releases/${newReleaseResponse.data.id}/assets`
      );
      await Promise.all(publishPromises);
    } catch (reason: any) {
      console.error(reason.data?.message ?? reason.response.data ?? reason);
      // Rethrow the error so that we can trigger a non-zero exit code to circle-ci
      throw reason;
    }
  }
}

export { GitHubRelease };
