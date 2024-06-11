# Backend

The contribution guidelines for Grafana backend developers contain a lot of information for anyone who wants to contribute to this open-source project. However, it isn't necessary for you to read all of it, so long as you read what is most relevant to you.

## Guidelines everyone should read

First, read the [backend style guide](/contribute/backend/style-guide.md)
to get a sense for how we work to ensure that the Grafana codebase is
consistent and accessible. The rest of the backend contributor
documentation is more relevant to reviewers and contributors looking to
make larger changes.

## Guidelines specifically for backend developers

For anyone reviewing code for Grafana's backend, a basic understanding
of content of the following files is expected:

- [Currently recommended practices](/contribute/backend/recommended-practices.md)
- [Services](/contribute/backend/services.md)
- [Communication](/contribute/backend/communication.md)
- [Database](/contribute/backend/database.md)
- [HTTP API](/pkg/api/README.md)

## Guidelines for contributors who make or review large changes to the backend

Reviewers who make or review large changes should additionally make a habit out
of familiarizing themselves with the entire contents of
[/contribute/backend](/contribute/backend) from time to time.

## Guidelines for dependency management

If you work with a dependency that requires an upgrade, refer to [Upgrading dependencies](/contribute/backend/upgrading-dependencies.md).
