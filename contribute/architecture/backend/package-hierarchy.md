# Package hierarchy

The Go packages in Grafana should be packaged by feature, keeping
packages as small as reasonable while retaining a clear sole ownership
of a single domain.

[Ben Johnson's standard package layout](https://medium.com/@benbjohnson/standard-package-layout-7cdbc8391fc1) serves as
inspiration for the way we organize packages.

## Principles of how to structure a service in Grafana

[](services.md)

### Domain types and interfaces should be in local "root" packages

Let's say you're creating a _tea pot_ service, place everything another
service needs to interact with the tea pot service in
_pkg/services/teapot_, choosing a name according to
[Go's package naming conventions](https://go.dev/blog/package-names).

Typically, you'd have one or more interfaces that your service provides
in the root package along with any types, errors, and other constants
that makes sense for another service interacting with this service to
use.

Avoid depending on other services when structuring the root package to
reduce the risk of running into circular dependencies.

### Sub-packages should depend on roots, not the other way around

Small-to-medium sized packages should be able to have only a single
sub-package containing the implementation of the service. By moving the
implementation into a separate package we reduce the risk of triggering
circular dependencies (in Go, circular dependencies are evaluated per
package and this structure logically moves it to be per type or function
declaration).

Large packages may need utilize multiple sub-packages at the discretion
of the implementor. Keep interfaces and domain types to the root
package.

### Try to name sub-packages for project wide uniqueness

Prefix sub-packages with the service name or an abbreviation of the
service name (whichever is more appropriate) to provide an ideally
unique package name. This allows `teaimpl` to be distinguished from
`coffeeimpl` without the need for package aliases, and encourages the
use of the same name to reference your package throughout the codebase.

### A well-behaving service provides test doubles for itself

Other services may depend on your service, and it's good practice to
provide means for those services to set up a test instance of the
dependency as needed. Refer to
[Google Testing's Testing on the Toilet: Know Your Test Doubles](https://testing.googleblog.com/2013/07/testing-on-toilet-know-your-test-doubles.html) for a brief
explanation of how we semantically aim to differentiate fakes, mocks,
and stubs within our codebase.

Place test doubles in a sub-package to your root package named
`<servicename>test` or `<service-abbreviation>test`, such that the `teapot` service may have the
`teapottest` or `teatest`

A stub or mock may be sufficient if the service is not a dependency of a
lot of services or if it's called primarily for side effects so that a
no-op default behavior makes sense.

Services which serve many other services and where it's feasible should
provide an in-memory backed test fake that can be used like the
regular service without the need of complicated setup.

### Separate store and logic

When building a new service, data validation, manipulation, scheduled
events and so forth should be collected in a service implementation that
is built to be agnostic about its store.

The storage should be an interface that is not directly called from
outside the service and should be kept to a minimum complexity to
provide the functionality necessary for the service.

A litmus test to reduce the complexity of the storage interface is
whether an in-memory implementation is a feasible test double to build
to test the service.

### Outside the service root

Some parts of the service definition remains outside the
service directory and reflects the legacy package hierarchy.
As of June 2022, the parts that remain outside the service are:

#### Migrations

`pkg/services/sqlstore/migrations` contains all migrations for SQL
databases, for all services (not including Grafana Enterprise).
Migrations are written per the [database.md](database.md#migrations) document.

#### API endpoints

`pkg/api/api.go` contains the endpoint definitions for the most of
Grafana HTTP API (not including Grafana Enterprise).

## Practical example

The following is a simplified example of the package structure for a
service that doesn't do anything in particular.

None of the methods or functions are populated and in practice most
packages will consist of multiple files. There isn't a Grafana-wide
convention for which files should exist and contain what.

`pkg/services/alphabetical`

```
package alphabetical

type Alphabetical interface {
  // GetLetter returns either an error or letter.
  GetLetter(context.Context, GetLetterQuery) (Letter, error)
  // ListCachedLetters cannot fail, and doesn't return an error.
  ListCachedLetters(context.Context, ListCachedLettersQuery) Letters
  // DeleteLetter doesn't have any return values other than errors, so it
  // returns only an error.
  DeleteLetter(context.Contxt, DeltaCommand) error
}

type Letter byte

type Letters []Letter

type GetLetterQuery struct {
  ID int
}

// Create queries/commands for methods even if they are empty.
type ListCachedLettersQuery struct {}

type DeleteLetterCommand struct {
  ID int
}

```

`pkg/services/alphabetical/alphabeticalimpl`

```
package alphabeticalimpl

// this name can be whatever, it's not supposed to be used from outside
// the service except for in Wire.
type Svc struct { … }

func ProviceSvc(numbers numerical.Numerical, db db.DB) Svc { … }

func (s *Svc) GetLetter(ctx context.Context, q root.GetLetterQuery) (root.Letter, error) { … }
func (s *Svc) ListCachedLetters(ctx context.Context, q root.ListCachedLettersQuery) root.Letters { … }
func (s *Svc) DeleteLetter(ctx context.Context, q root.DeleteLetterCommand) error { … }

type letterStore interface {
  Get(ctx.Context, id int) (root.Letter, error)
  Delete(ctx.Context, root.DeleteLetterCommand) error
}

type sqlLetterStore struct {
  db.DB
}

func (s *sqlStore) Get(ctx.Context, id int) (root.Letter, error) { … }
func (s *sqlStore) Delete(ctx.Context, root.DeleteLetterCommand) error { … }
```

## Legacy package hierarchy

> **Note:** A lot of services still adhere to the legacy model as outlined below. While it is ok to
> extend existing services based on the legacy model, you are _strongly_ encouraged to structure any
> new services or major refactorings using the new package layout.

Grafana has long used a package-by-layer layout where domain types
are placed in **pkg/models**, all SQL logic in **pkg/services/sqlstore**,
and so forth.

This is an example of how the _tea pot_ service could be structured
throughout the codebase in the legacy model.

- _pkg/_
  - _api/_
    - _api.go_ contains the endpoints for the
    - _tea_pot.go_ contains methods on the _pkg/api.HTTPServer_ type
      that interacts with the service based on queries coming in via the HTTP
      API.
    - _dtos/tea_pot.go_ extends the _pkg/models_ file with types
      that are meant for translation to and from the API. It's not as commonly
      present as _pkg/models_.
  - _models/tea_pot.go_ contains the models for the service, this
    includes the _command_ and _query_ structs that are used when calling
    the service or SQL store methods related to the service and also any
    models representing an abstraction provided by the service.
  - _services/_
    - _sqlstore_
      - _tea_pot.go_ contains SQL queries for
        interacting with stored objects related to the tea pot service.
      - _migrations/tea_pot.go_ contains the migrations necessary to
        build the
    - _teapot/\*_ contains functions or a service for doing
      logical operations beyond those done in _pkg/api_ or _pkg/services/sqlstore_
      for the service.

The implementation of legacy services varies widely from service to
service, some or more of these files may be missing and there may be
more files related to a service than those listed here.

Some legacy services providing infrastructure will also take care of the
integration with several domains. The cleanup service both
provides the infrastructure to occasionally run cleanup scripts and
defines the cleanup scripts. Ideally, this would be migrated
to only handle the scheduling and synchronization of clean up jobs.
The logic for the individual jobs would be placed with a service that is
related to whatever is being cleaned up.
