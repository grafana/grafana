To build the docs locally, you need to have docker installed.  The docs are built using a custom [docker](https://www.docker.com/)
image and [mkdocs](http://www.mkdocs.org/).

Build the `grafana/docs-base:latest` image:

```
$ git clone https://github.com/grafana/docs-base
$ cd docs-base
$ make docs-build
```

To build the docs:
```
$ cd docs
$ make docs
```

Open [localhost:8180](http://localhost:8180) to view the docs.
