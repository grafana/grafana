# Building the docs locally

When you contribute to documentation, it is a good practice to build the docs on your local machine to make sure your changes appear as you expect. This README explains the process for doing that.

## Requirements

Docker >= 2.1.0.3

## Build the doc site


1. In the command line, make sure you are in the docs folder: `cd docs`.
2. Run `make build`. This builds the docker image with the correct version of Hugo.
3. Run `make run`. This runs the container. It will start a hugo sever, and you can naviagate to the site in your browser at `localhost:1313`. 

You can then edit files in the `sources` directory which will update `localhost:1313` when changes are saved.

---

## Content Guidelines

Edit content in the `sources` directory.

### Using `relref` for internal links

Use the hugo shortcode [relref](https://gohugo.io/content-management/cross-references/#use-ref-and-relref) anytime you are linking to other internal docs pages.

### Editing the Sidebar Menu

Edit [sources/menu.yaml](sources/menu.yaml) to make changes to the sidebar. Restart the `make run` command for changes to take effect.

### Add images

Images are currently hosted in the grafana/website repo.

---

## Deploy changes to grafana.com

Anytime a PR is merged to master with changes in the `docs` directory, those changes are synced via GitHub action to the grafana/website repo on the `docs-grafana` branch.

In order to make those changes live, open a PR in the website repo that merges the `docs-grafna` branch into `master`. Then follow the publishing guidelines in that repo.
