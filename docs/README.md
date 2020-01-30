# Building the docs locally

When you contribute to documentation, it is a good practice to build the docs on your local machine to make sure your changes appear as you expect. This README explains the process for doing that.

## Requirements

Docker >= 2.1.0.3

## Build the doc site

1. In the command line, make sure you are in the docs folder: `cd docs`.
2. Run `make docs`. This launches a preview of the docs website at `http://localhost:3002/docs/grafana/latest/` which will refresh automatically when changes to content in the `sources` directory are made.

---

## Content guidelines

Edit content in the `sources` directory.

### Using `relref` for internal links

Use the Hugo shortcode [relref](https://gohugo.io/content-management/cross-references/#use-ref-and-relref) any time you are linking to other internal docs pages.

### Edit the side menu

Edit [sources/menu.yaml](sources/menu.yaml) to make changes to the sidebar. Stop and rerun the `make docs` command for changes to take effect.

### Add images

Images are currently hosted in the grafana/website repo.

---

## Deploy changes to grafana.com

When a PR is merged to master with changes in the `docs` directory, those changes are automatically synched to the grafana/website repo on the `docs-grafana` branch.

In order to make those changes live, open a PR in the website repo that merges the `docs-grafana` branch into `master`. Then follow the publishing guidelines in that repo.
