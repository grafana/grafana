
# Contributing

Grafana uses GitHub to manage contributions.
Contributions take the form of pull requests that will be reviewed by the core team.

* If you are a new contributor see: [Steps to Contribute](#steps-to-contribute)

* If you have a trivial fix or improvement, go ahead and create a pull request.

* If you plan to do something more involved, discuss your idea on the respective [issue](https://github.com/grafana/grafana/issues) or create a [new issue](https://github.com/grafana/grafana/issues/new) if it does not exist. This will avoid unnecessary work and surely give you and us a good deal of inspiration.

* Sign our [CLA](http://docs.grafana.org/contribute/cla/). 

* For changes in the backend, follow the style guides used in Go [Code Review Comments](https://code.google.com/p/go-wiki/wiki/CodeReviewComments) and Peter Bourgon's [Go: Best Practices for Production Environments](http://peter.bourgon.org/go-in-production/#formatting-and-style)

## Steps to Contribute

Should you wish to work on a GitHub issue, check first if it is not already assigned to someone. If it is free, you claim it by commenting on the issue that you want to work on it. This is to prevent duplicated efforts from contributors on the same issue.

Please check the [`beginner friendly`](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22beginner+friendly%22) label to find issues that are good for getting started. If you have questions about one of the issues, with or without the tag, please comment on them and one of the core team or the original poster will clarify it.

## Pull Request Checklist

* Branch from the master branch and, if needed, rebase to the current master branch before submitting your pull request. If it doesn't merge cleanly with master you may be asked to rebase your changes.

* If your patch is not getting reviewed or you need a specific person to review it, you can @-reply a reviewer asking for a review in the pull request or a comment.

* Add tests relevant to the fixed bug or new feature.

### Pull requests with new features
Commits should be as small as possible, while ensuring that each commit is correct independently (i.e., each commit should compile and pass tests).

Make sure to include `closes #<issue>` or `fixes #<issue>` in the pull request description. 

### Pull requests with bug fixes
Please make all changes in one commit if possible. Include `closes #12345` in bottom of the commit message.
A commit message for a bug fix should look something like this.

```
avoid infinite loop in the dashboard provisioner

if one dashboard with an uid is refered to by two
provsioners each provisioner overwrite each other.
filling up dashboard_versions quite fast if using
default settings.

closes #12864
```

If the pull request needs changes before its merged the new commits should be rebased into one commit before its merged. 