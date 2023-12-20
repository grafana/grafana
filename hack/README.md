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

You can clone k8s [code-generator](https://github.com/kubernetes/code-generator) here and use `CODEGEN_PKG=<CODE-GENERATOR-GIT-ROOT>` when running the `update-codegen.sh` script.

The current workflow (sorry!) is to:

1. update the script to point to the group+version you want
2. run the `update-codegen.sh` script. This will produce a bunch of new files
3. move `pkg/generated/openapi/zz_generated.openapi.go` to `pkg/apis/{group/version}/zz_generated.openapi.go`.
4. edit the package name so it is {version} and remove the boilerplate k8s kinds
5. `rm -rf pkg/generated` -- we are not yet using most of the generated client stuff

Once we are more comfortable with the outputs and process, we will build these steps into a more standard codegen pattern, but until then... happy hacking!
