# Building The Docs

To build the docs locally, you need to have docker installed.  The
docs are built using a hugo.

**Prepare the Docker Image**:

Git clone `grafana/grafana.org` repo. Run these commands in the root of that repo. **Note** that you may require ``sudo``
when running ``make docs-build`` depending on how your system's docker
service is configured):

```
git clone https://github.com/grafana/grafana.org
cd grafana.org
make docs-build
```

**Build the Documentation**:

Now that the docker image has been prepared we can build the
grafana docs and start a docs server. Switch your working directory back to the directory this file
(README.md) is in and run (possibly with ``sudo``):

```
make watch
```

This command will not return control of the shell to the user. Instead
the command is now running a new docker container built from the image
we created in the previous step.

Open [localhost:3004](http://localhost:3004) to view the docs.

### Images & Content

All markdown files are located in this repo (main grafana repo). But all images are added to the https://github.com/grafana/grafana.org repo. So the process of adding images is a bit complicated. 

First you need create a feature (PR) branch of https://github.com/grafana/grafana.org so you can make change. Then add the image to the `/static/img/docs` directory. Then make a commit that adds the image. 

The run 
```
make docs-build
```

This will rebuild the docs docker container. 

To be able to use the image your have to quit  (CTRL-C) the `make watch` command (that you run in the same directory as this README). Then simply rerun `make watch`, it will restart the docs server but now with access to your image. 

### Editing content

Changes to the markdown files should automatically cause a docs rebuild and live reload should reload the page in your browser. 
