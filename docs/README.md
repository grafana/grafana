# Building the docs locally

When you contribute to documentation, it is a good practice to build the docs on your local machine to make sure your changes appear as you expect. This README explains the process for doing that.

## Requirements

Docker >= 2.1.0.3
Yarn >= 1.22.4

## Build the doc site

1. On the command line, first change to the docs folder: `cd docs`.
1. Run `make docs`. This launches a preview of the docs website at `http://localhost:3002/docs/grafana/latest/` which will refresh automatically when changes are made to content in the `sources` directory.

If you have the grafana/website repo checked out in the same directory as the grafana repo, then you can run `make docs-local-static` to use local assets (such as images).

---

## Content guidelines

Edit content in the `sources` directory.

### Using `relref` for internal links

Use the Hugo shortcode [relref](https://gohugo.io/content-management/cross-references/#use-ref-and-relref) any time you are linking to other internal docs pages.

Syntax is:
```
{{< relref "example.md" >}}
```

You might need to add more context for the link (containing folders and so on, `folder/example.md`) if Hugo says the relref is ambiguous. 


### Edit the side menu

The side menu is automatically build from the file structure. Use the [weight](https://gohugo.io/templates/lists/#by-weight) front matter parameter to order pages.

### Add images

Images are currently hosted in the grafana/website repo.

---

## Deploy changes to grafana.com

When a PR is merged to master with changes in the `docs/sources` directory, those changes are automatically synced to the grafana/website repo and published to the staging site.

Generally, someone from marketing will publish to production each day: so as long as the sync is successful your docs edits will be published. Alternatively, you can refer to [publishing to production](https://github.com/grafana/website#publishing-to-production-grafanacom) if you'd like to do it yourself.
