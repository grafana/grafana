# Building The Docs

To build the docs locally, you need to have docker installed.  The
docs are built using a custom [docker](https://www.docker.com/) image
and the [mkdocs](http://www.mkdocs.org/) tool.

**Prepare the Docker Image**:

Build the `grafana/docs-base:latest` image. Run these commands in the
same directory this file is in. **Note** that you may require ``sudo``
when running ``make docs-build`` depending on how your system's docker
service is configured):

```
$ git clone https://github.com/grafana/docs-base
$ cd docs-base
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

Open [localhost:8180](http://localhost:8180) to view the docs.

**Note** that after running ``make docs`` you may notice a message
like this in the console output

> Running at: http://0.0.0.0:8000/

This is misleading. That is **not** the port the documentation is
served from. You must browse to port **8180** to view the new
documentation.


# Adding a New Page

Adding a new page requires updating the ``mkdocs.yml`` file which is
located in this directory.

For example, if you are adding documentation for a new HTTP API called
``preferences`` you would:

1. Create the file ``docs/sources/http_api/preferences.md``
1. Add a reference to it in ``docs/sources/http_api/overview.md``
1. Update the list under the **pages** key in the ``docs/mkdocs.yml`` file with a reference to your new page:


```yaml
- ['http_api/preferences.md', 'API', 'Preferences API']
```
