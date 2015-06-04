# How to contribute

Elastic is an open-source project and we are looking forward to each
contribution.

## Your Pull Request

To make it easy to review and understand your changes, please keep the
following things in mind before submitting your pull request:

* Work on the latest possible state of `olivere/elastic`.
* Create a branch dedicated to your change.
* If possible, write a test case which confirms your change.
* Make sure your changes and your tests work with all recent versions of
  Elasticsearch. At the moment, we're targeting the current and the previous
  release, e.g. the 1.4 and the 1.3 branch.
* Test your changes before creating a pull request (`go test ./...`).
* Don't mix several features or bug fixes in one pull request.
* Create a meaningful commit message.
* Explain your change, e.g. provide a link to the issue you are fixing and
  probably a link to the Elasticsearch documentation and/or source code.
* Format your source with `go fmt`.

## Additional Resources

* [GitHub documentation](http://help.github.com/)
* [GitHub pull request documentation](http://help.github.com/send-pull-requests/)
