# Building The Docs

To build the docs locally, you need to have docker installed.  The
docs are built using a custom [docker](https://www.docker.com/) image
and the [mkdocs](http://www.mkdocs.org/) tool.

**Prepare the Docker Image**:

Git clone `grafana/grafana.org` repo. Run these commands in the root of that repo. **Note** that you may require ``sudo``
when running ``make docs-build`` depending on how your system's docker
service is configured):

```
$ git clone https://github.com/grafana/grafana.org
$ cd grafana.org
$ make docs-build
```

**Build the Documentation**:

Now that the docker image has been prepared we can build the
docs. Switch your working directory back to the directory this file
(README.md) is in and run (possibly with ``sudo``):

```
$ make docs
```

This command will not return control of the shell to the user. Instead
the command is now running a new docker container built from the image
we created in the previous step.

Open [localhost:3004](http://localhost:3004) to view the docs.


