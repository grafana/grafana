# Kubernetes HACK Alert

This is a hack folder for kubernetes codegen scripts. Oddly, a /hack/ folder seems to be standard kubernetes development practice ¯\_(ツ)\_/¯

The workflow is a WIP, however we are trying to leverage as many off-the-shelf patterns as possible.

For these scripts to work, your local GOROOT/src/grafana/grafana must point to this git checkout. For my setup this is:

```
❯ pwd
/Users/ryan/go/src/github.com/grafana
❯ ls -l
total 0
lrwxr-xr-x  1 ryan  staff  37 Oct  5 09:34 grafana -> /Users/ryan/workspace/grafana/grafana
```

The current workflow is to run the following:

```shell
# ensure k8s.io/code-generator pkg is up to date
go mod download

# the happy path
./hack/update-codegen.sh
```

Note that the script deletes existing openapi go code and regenerates in place so that you will temporarily see
deleted files in your `git status`. After a successful run, you should see them restored.

If resource client is not generated for your resource make sure that it follows the k8s guidelines for structuring the resource definition

- the directory is named after resource version, i.e. `<resource_name>/v<version>` (e.g. service/v0alpha1)
- the resource directory contains file `types.go` that includes resource definitions
- the resource definitions are annotated with comment `// +genclient`
