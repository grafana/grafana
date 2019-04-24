# Building The Docs

To build the docs locally, you need to have docker installed.  The
docs are built using [Hugo](http://gohugo.io/) - a static site generator.

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

Then run (possibly with ``sudo``):

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

Then run:
```
make docs-build
```

This will rebuild the docs docker container. 

To be able to use the image you have to quit  (CTRL-C) the `make watch` command (that you run in the same directory as this README). Then simply rerun `make watch`, it will restart the docs server but now with access to your image. 

### Editing content

Changes to the markdown files should automatically cause a docs rebuild and live reload should reload the page in your browser. 
