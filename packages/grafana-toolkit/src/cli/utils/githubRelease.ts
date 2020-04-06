import { getPluginId } from '../../config/utils/getPluginId';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { getCiFolder } from '../../plugins/env';
import path = require('path');
import fs = require('fs');
// @ts-ignore
// import execa = require('execa');
import GithubClient from './githubClient';
import { AxiosResponse } from 'axios';

const resolveContentType = (extension: string): string => {
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
      repo: repository,
    });
  }

  async publishAssets(srcLocation: string, destUrl: string) {
    // Add the assets. Loop through files in the ci/dist folder and upload each asset.
    fs.readdir(srcLocation, (err: NodeJS.ErrnoException | null, files: string[]) => {
      if (err) {
        throw err;
      }

      files.forEach(async (file: string) => {
        const fileStat = fs.statSync(`${srcLocation}/${file}`);
        const fileData = fs.readFileSync(`${srcLocation}/${file}`);
        try {
          await this.git.client.post(`${destUrl}?name=${file}`, fileData, {
            headers: {
              'Content-Type': resolveContentType(path.extname(file)),
              'Content-Length': fileStat.size,
            },
          });
        } catch (reason) {
          console.log('Could not post', reason);
        }
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
      const latestRelease: AxiosResponse<any> = await this.git.client.get('releases/latest');

      // Re-release if the version is the same as an existing release
      if (latestRelease.data.tag_name === `v${pluginInfo.version}`) {
        await this.git.client.delete(`releases/${latestRelease.data.id}`);
      }

      // Now make the release
      const newReleaseResponse = await this.git.client.post('releases', {
        tag_name: `v${pluginInfo.version}`,
        target_commitish: commitHash,
        name: `v${pluginInfo.version}`,
        body: this.releaseNotes,
        draft: false,
        prerelease: false,
      });

      this.publishAssets(
        PUBLISH_DIR,
        `https://uploads.github.com/repos/${this.username}/${this.repository}/releases/${newReleaseResponse.data.id}/assets`
      );
    } catch (reason) {
      console.error('error', reason);
    }
  }
}

export { GitHubRelease };
