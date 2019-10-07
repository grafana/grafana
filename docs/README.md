### Note for external contributors

We are currently working on migrating the docs to a new static website. The `grafana/website` repository will be private during this migration, which unfortunately means the docs site can't be built without access.

The Markdown content however, is still public in this repository. We still encourage pull requests to make the docs better, and we will make sure the changed content works well on the current docs site. Include any images in your pull request, and we will move them to the `grafana/website` repository.

# Building the docs

To build the docs locally, you need to have Docker installed. The docs are built using [Hugo](http://gohugo.io/) - a static site generator.

**Prepare the Docker image**:

> Due to migration to new static site, the Docker image needs to be built from `old-docs` branch.

Git clone `grafana/website` repo. Run these commands in the root of that repo. **Note** that you may require `sudo`
when running `make docs-build` depending on how your system's Docker
service is configured):

```
git clone https://github.com/grafana/website
cd website
make docs-build
```

**Build the Documentation**:

Now that the Docker image has been prepared we can build the
grafana docs and start a docs server.

If you have not cloned the Grafana repository already then:

```
cd ..
git clone https://github.com/grafana/grafana
```

Switch your working directory to the directory this file
(README.md) is in.

```
cd grafana/docs
```

An AWS config file is required to build the docs Docker image and to publish the site to AWS. If you are building locally only and do not have any AWS credentials for docs.grafana.org then create an empty file named `awsconfig` in the current directory.

```
touch awsconfig
```

Then run (possibly with `sudo`):

```
make watch
```

This command will not return control of the shell to the user. Instead
the command is now running a new Docker container built from the image
we created in the previous step.

Open [localhost:3004](http://localhost:3004) to view the docs.

### Images and Content

All markdown files are part of [this repository](https://github.com/grafana/grafana). However, all images are added to the [website repository](https://github.com/grafana/website). Therefore, the process of adding images is not as straightforward. These are the steps:

1. Ensure you create a feature branch within the [website repository](https://github.com/grafana/website) to make the change. This branch needs to be based on the `old-docs` branch.
1. Ensure the image(s) are compressed and optimised e.g. Using [tinypng](https://tinypng.com/).
1. Add the image(s) to the `/static/img/docs` directory.
1. Then, make a commit that adds the image(s).
1. The Pull Request you create needs to target where you branched off, the branch `old-docs`.

Finally, run:

```
make docs-build
```

This will rebuild the docs Docker image.

To be able to use your image(s) you have to quit (Ctrl+C) the `make watch` command (that you run in the same directory as this README). Then simply rerun `make watch`, it will restart the docs server but now with access to your image(s).

### Editing content

Changes to the markdown files should automatically cause a docs rebuild and live reload should reload the page in your browser.

### Troubleshooting

#### Running `make watch` errors out with `Warning: Task "default" not found.`

Ensure that the Docker image from the [website repository](https://github.com/grafana/website) is built using the `old-docs` branch.
