# Contributing to Lodash

Contributions are always welcome. Before contributing please read the
[code of conduct](https://jquery.org/conduct/) &
[search the issue tracker](https://github.com/lodash/lodash/issues); your issue
may have already been discussed or fixed in `master`. To contribute,
[fork](https://help.github.com/articles/fork-a-repo/) Lodash, commit your changes,
& [send a pull request](https://help.github.com/articles/using-pull-requests/).

## Feature Requests

Feature requests should be submitted in the
[issue tracker](https://github.com/lodash/lodash/issues), with a description of
the expected behavior & use case, where they’ll remain closed until sufficient interest,
[e.g. :+1: reactions](https://help.github.com/articles/about-discussions-in-issues-and-pull-requests/),
has been [shown by the community](https://github.com/lodash/lodash/issues?q=label%3A%22votes+needed%22+sort%3Areactions-%2B1-desc).
Before submitting a request, please search for similar ones in the
[closed issues](https://github.com/lodash/lodash/issues?q=is%3Aissue+is%3Aclosed+label%3Aenhancement).

## Pull Requests

For additions or bug fixes you should only need to modify `lodash.js`. Include
updated unit tests in the `test` directory as part of your pull request. Don’t
worry about regenerating the `dist/` or `doc/` files.

Before running the unit tests you’ll need to install, `npm i`,
[development dependencies](https://docs.npmjs.com/files/package.json#devdependencies).
Run unit tests from the command-line via `npm test`, or open `test/index.html` &
`test/fp.html` in a web browser. The [Backbone](http://backbonejs.org/) &
[Underscore](http://underscorejs.org/) test suites are included as well.

## Contributor License Agreement

Lodash is a member of the [jQuery Foundation](https://jquery.org/).
As such, we request that all contributors sign the jQuery Foundation
[contributor license agreement (CLA)](https://contribute.jquery.org/CLA/).

For more information about CLAs, please check out Alex Russell’s excellent post,
[“Why Do I Need to Sign This?”](https://infrequently.org/2008/06/why-do-i-need-to-sign-this/).

## Coding Guidelines

In addition to the following guidelines, please follow the conventions already
established in the code.

- **Spacing**:<br>
  Use two spaces for indentation. No tabs.

- **Naming**:<br>
  Keep variable & method names concise & descriptive.<br>
  Variable names `index`, `array`, & `iteratee` are preferable to
  `i`, `arr`, & `fn`.

- **Quotes**:<br>
  Single-quoted strings are preferred to double-quoted strings; however,
  please use a double-quoted string if the value contains a single-quote
  character to avoid unnecessary escaping.

- **Comments**:<br>
  Please use single-line comments to annotate significant additions, &
  [JSDoc-style](http://www.2ality.com/2011/08/jsdoc-intro.html) comments for
  functions.

Guidelines are enforced using [JSCS](https://www.npmjs.com/package/jscs):
```bash
$ npm run style
```

## Tips

You can opt-in to a pre-push git hook by adding an `.opt-in` file to the root of
the project containing:
```txt
pre-push
```

With that, when you `git push`, the pre-push git hook will trigger and execute
`npm run validate`.
