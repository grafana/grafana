
# Contributing

Grafana uses GitHub to manage contributions.
Contributions take the form of pull requests that will be reviewed by the core team.

* If you are a new contributor see: [Steps to Contribute](#steps-to-contribute)

* If you have a trivial fix or improvement, go ahead and create a pull request.

* If you plan to do something more involved, discuss your idea on the respective [issue](https://github.com/grafana/grafana/issues) or create a [new issue](https://github.com/grafana/grafana/issues/new) if it does not exist. This will avoid unnecessary work and surely give you and us a good deal of inspiration. 


## Steps to Contribute

Should you wish to work on a GitHub issue, check first if it is not already assigned to someone. If it is free, you claim it by commenting on the issue that you want to work on it. This is to prevent duplicated efforts from contributors on the same issue.

Please check the [`beginner friendly`](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22beginner+friendly%22) label to find issues that are good for getting started. If you have questions about one of the issues, with or without the tag, please comment on them and one of the core team or the original poster will clarify it.



## Setup

Follow the setup guide in README.md

### Rebuild frontend assets on source change
```
yarn watch
```

### Rerun tests on source change
```
yarn jest
```

### Run tests for backend assets before commit
```
test -z "$(gofmt -s -l . | grep -v -E 'vendor/(github.com|golang.org|gopkg.in)' | tee /dev/stderr)"
```

### Run tests for frontend assets before commit
```
yarn test
go test -v ./pkg/...
```


## Pull Request Checklist

* Branch from the master branch and, if needed, rebase to the current master branch before submitting your pull request. If it doesn't merge cleanly with master you may be asked to rebase your changes.

* Commits should be as small as possible, while ensuring that each commit is correct independently (i.e., each commit should compile and pass tests).

* If your patch is not getting reviewed or you need a specific person to review it, you can @-reply a reviewer asking for a review in the pull request or a comment.

* Add tests relevant to the fixed bug or new feature.
