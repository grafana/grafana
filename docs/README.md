# Building the docs locally

When you contribute to documentation, it's a good practice to build the docs on your local machine to make sure your changes appear as you expect. This README explains the process for doing that.

To build a local version, you need to run a process in a Docker container.
Grafana periodically updates the Docker image, [`docs-base`](https://hub.docker.com/r/grafana/docs-base), to update the styling of the Docs.

## Requirements

- Docker >= 2.1.0.3
- Yarn >= 1.22.4

## Build the doc site

First, make sure the Docker daemon is running on your machine. Then, follow these steps:

1. On the command line, first change to the docs folder: `cd docs`.
1. Run `make docs`. This launches a preview of the website with the current grafana docs at `http://localhost:3002/docs/grafana/latest/` which will refresh automatically when changes are made to content in the `sources` directory.

If you have the grafana/website repo checked out in the same directory as the grafana repo, then you can run `make docs-local-static` to use local assets (such as images).

---

## Content guidelines

Edit content in the `sources` directory.

### [Contributing](/contribute/documentation/README.md)

### Using `relref` for internal links

Use the Hugo shortcode [relref](https://gohugo.io/content-management/cross-references/#use-ref-and-relref) any time you are linking to other internal docs pages.

Syntax is:

```
{{< relref "example.md" >}}
```

You might need to add more context for the link (containing folders and so on, `folder/example.md`) if Hugo says the relref is ambiguous.

### Managing redirects

When moving content around or removing pages it's important that users following old links are properly redirected to the new location. We do this using the [aliases](https://gohugo.io/content-management/urls/#aliases) feature in Hugo.

If you are moving a page, add an `aliases` entry in the front matter referencing the old location of the page which will redirect the old url to the new location.

If you are removing a page, add an `aliases` entry in the front matter of the most-applicable page referencing the location of the page being removed.

If you are copying an existing page as the basis for a new one, be sure to remove any `aliases` entries in the front matter in your copy to avoid conflicting redirects.

### Edit the side menu

The side menu is automatically build from the file structure. Use the [weight](https://gohugo.io/templates/lists/#by-weight) front matter parameter to order pages.

To specify different menu text from the page title, use the front matter parameter `menuTitle`.

### Add images

Please see our help documentation on [Image, diagram, and screenshot guidelines](https://grafana.com/docs/writers-toolkit/writing-guide/image-guidelines/) for comprehensive information.

---

## Deploy changes to grafana.com

When a PR is merged with changes in the `docs/sources` directory, those changes are automatically synced by a GitHub action (`.github/workflows/publish.yml`) to the grafana/website repo.

- A PR that targets the `main` branch syncs to the `content/docs/grafana/next` directory in the `website` repository, and publishes to `https://grafana.com/docs/grafana/next/`.
- A PR targeting the `latest/current` release branch syncs to the `content/docs/grafana/latest` directory in the `website` repository, and publishes to `https://grafana.com/docs/grafana/latest/`.

Once the sync is complete, the website will automatically publish to production - no further action is needed.
