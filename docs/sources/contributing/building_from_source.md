---
page_title: Building from source
page_description: Building from source Grafana.
page_keywords: grafana, build, contribute, documentation
---

# Building from source

If you have any idea for an improvement or found a bug do not hesitate to open an issue.
And if you have time clone [the grafana repository](https://github.com/grafana/grafana) and submit a pull request and help me make Grafana
the kickass metrics & devops dashboard we all dream about!

Grafana uses nodejs and grunt as a build system for javascript, less compilation, and unit tests.

## Get started

 - Install nodejs.
 - npm install -g grunt-cli
 - npm install (in grafana repository root)

### run development server

 - grunt server

### run less & jshint checks
 - grunt

### run unit tests
 - grunt test

### create optimized, minified build
 - grunt build   (or grunt release to get zip/tar files)


## Create a pull requests

Before or after your create a pull requests, sign the [contributor license aggrement](/docs/contributing/cla.html).
