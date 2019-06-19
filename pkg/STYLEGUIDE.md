# Backend style guide

Grafanas backend has been developed for a long time with a mix of code styles.

This style guide is a guide for how we want to write Go code in the future. Generally, we want to follow the style guides used in Go [Code Review Comments](https://code.google.com/p/go-wiki/wiki/CodeReviewComments) and Peter Bourgon's [Go: Best Practices for Production Environments](http://peter.bourgon.org/go-in-production/#formatting-and-style)

## Linting and formatting
We enforce strict `gofmt` formating and use some linters on our codebase. You can find the current list of linters at https://github.com/grafana/grafana/blob/master/scripts/backend-lint.sh

We use [revive](https://github.com/mgechev/revive) as a go linter, and do enforce our [custom config](https://github.com/grafana/grafana/blob/master/conf/revive.toml) for it.

The end goal is to follow the golint. And the approuch for reachin that goal is to lint all parts of the codebase that we are currently working on and enable stricter linting for more areas as we go. 

## Testing
We use GoConvey for BDD/scenario based testing. Which we think is useful for testing certain chain or interactions. Ex https://github.com/grafana/grafana/blob/master/pkg/services/auth/auth_token_test.go

We value clean & readable code that is loosely coupled and covered by unit tests. This makes it easier to collaborate and maintain the code. In the sqlstore package we do database operations in tests and while some might say that's not suited for unit tests. We think they are fast enough and provide a lot of value. 

For new tests its preferred to use standard library testing.

### Mocks/Stubs
As a general rule of thumb we try to override/replace functions/methods when mocks/stubs are needed. One common task is the need of overriding time (`time.Now()`). See usage of `getTime` variable in [code](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/services/auth/auth_token.go#L22) and in [test](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/services/auth/auth_token_test.go#L23-L26) as an example.

When you need to stub/mock an interface you can implement a struct that allows you to override methods on a test-by-test basis. See [stub](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/services/auth/testing.go) and [example usage](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/middleware/middleware_test.go#L153-L180).
