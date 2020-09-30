publish-to-git
==============

[GitHub Action](https://github.com/features/actions) for publishing a directory
and its contents to another git repository.

This can be especially useful for publishing static website, such as with
[GitHub Pages](https://pages.github.com/), from built files in other job
steps, such as [Doxygen](http://www.doxygen.nl/) generated HTML files.

> **Note:** GitHub currently requires the use of a Personal Access Token for
pushing to other repositories. Pushing to the current repository should work
with the always-available GitHub Token (available via
`{{ secrets.GITHUB_TOKEN }}`. If pushing to another repository, a Personal
Access Token will need to be [created](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line) and assigned to the
workflow [secrets](https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables).

Inputs
------

- `repository`: Destination repository (default: current repository).
- `branch`: Destination branch (required).
- `host`: Destination git host (default: `github.com`).
- `github_token`: GitHub Token (required; use `secrets.GITHUB_TOKEN`).
- `github_pat`: Personal Access Token or other https credentials.
- `source_folder`: Source folder in workspace to copy (default: workspace root).
- `target_folder`: Target folder in destination branch to copy to (default: repository root).
- `commit_author`: Override commit author (default: `{github.actor}@users.noreply.github.com`).
- `commit_message`: Set commit message (default: `[workflow] Publish from [repository]:[branch]/[folder]`).
- `dry_run`: Does not push if non-empty (default: empty).
- `working_directory`: Location to checkout repository (default: random location in `${HOME}`)

Outputs
-------

- `commit_hash`: SHA hash of the new commit.
- `working_directory`: Working directory of git clone of repository.

License
-------

MIT License. See [LICENSE](LICENSE) for details.

Usage Example
-------------

```yaml
jobs:
  publish:
    - uses: actions/checkout@master
    - run: |
        sh scripts/build-doxygen-html.sh --out static/html
    - uses: seanmiddleditch/gha-publish-to-git@master
      with:
        branch: gh-pages
        github_token: '${{ secrets.GITHUB_TOKEN  }}'
        github_pat: '${{ secrets.GH_PAT }}'
        source_folder: static/html
      if: success() && github.event == 'push'
```
