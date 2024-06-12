# Handle breaking changes in Grafana frontend APIs

Follow this guide to identify and communicate breaking changes introduced to our frontend API.

- [What are our public APIs?](#what-are-our-public-apis)
- [What is Levitate?](#what-is-levitate)
- [What does the CI workflow look like?](#what-does-the-ci-workflow-look-like)
- [What do comments on my PR mean?](#what-do-comments-on-my-pr-mean)
- [I know it's a breaking change, what's next?](#i-know-its-a-breaking-change-whats-next)
  - [Introduce breaking changes only in major versions](#introduce-breaking-changes-only-in-major-versions)
  - [Deprecate first](#deprecate-first)
  - [Communicate](#communicate)
- [Who can help with other questions?](#who-can-help-with-other-questions)

---

## What are our public APIs?

The Grafana frontend codebase exposes functionality through NPM packages to make plugin development easier and faster.
These packages live in the `/packages` folder and contain packages like:

- `@grafana/data`
- `@grafana/runtime`
- `@grafana/ui`
- [(more packages...)](https://github.com/grafana/grafana/tree/main/packages)

Any change that causes dependent software to behave differently is considered to be breaking.

## What is Levitate?

[`@grafana/levitate`](https://github.com/grafana/levitate) is a tool created by Grafana that can show breaking changes between two versions of a TypeScript package or a source file.

Levitate can list exported members of an NPM package or imports used by an NPM package, _but it is most commonly used for comparing different versions of the same package to see changes in the exported members._

A GitHub workflow runs against every pull request and comments a hint if there are possible breaking changes.
It also adds the `breaking change` label to the pull request.

## What does the CI workflow look like?

<img src="./breaking-changes-workflow.png" alt="CI workflow" width="700" />

## What do comments on my PR mean?

![A GitHub comment posted by the github-actions bot that says that grafana-runtime has possible breaking changes. It has links for more info and to check console output.](./breaking-changes-comment-screenshot.png)

Receiving a comment like this does not necessarily mean that you actually introduced breaking
changes. This is because certain edge cases are still not covered by the tool, but there is a good chance that they may happen, so we call it to your attention.

By clicking the links in the comment ("more info" or "Check console output") you can view more detailed information about what triggered the notification.

**Removed exported members** (console view):<br />
This means that some previously exported members won't be available in the newer version of the package, so dependent plugins can break.

![A table from the console bot showing the Property, Location, and Diff of the breaking changes.](./breaking-changes-console-screenshot-1.png)

**Changed an existing member** (console view):<br />
This means that a member was changed in a way that can break dependent plugins.

![A table from the console bot showing how a changed number affects the Property, Location, and Diff of the breaking changes.](./breaking-changes-console-screenshot-2.png)

**No breaking changes** (console view):<br />
Seeing this suggests that while changes were made, most probably none of them were breaking. You are good to go! 👏

![A table from the console bot showing that there were no breaking changes.](./breaking-changes-console-screenshot-3.png)

## How can I decide if it is really a breaking change?

First, go to the console output of the workflow and make sure that the diffs make sense.

It can happen that Levitate highlights a change which is marked with TSDoc tags `// @alpha` or `// @internal`, in
which case you can choose to ignore it. Keep in mind though that these flags won't really hold developers back
from using your code and most likely it is going to cause them problems if we are breaking them.

It can also happen that Levitate marks changing an interface as a possible breaking change.
Introducing a new property will break the code of anyone who implements that interface. While this is correctly marked as a breaking change maybe it is an interface that is never implemented by other developers. If this is the case, then you can choose to ignore Levitate's message.

These notifications are only warnings though, and _in the end it's up to the author of the PR to make a decision that makes the most sense._

## I know it's a breaking change, what's next?

### Introduce breaking changes only in major versions

We can make breaking changes less painful if they are only happening between major releases of Grafana.

### Deprecate first

Whenever possible try to deprecate first what you are about to remove or change. For example:

```javascript
import { deprecationWarning } from '@grafana/data';

/**
 * @deprecated -- this is no longer necessary and will be removed in Grafana 9.0.0
 */
myOldFunction(name: string) {
    deprecationWarning('MyFile', 'myOldFunction', 'myNewFunction');
    // ...
}
```

1. Add a deprecation comment `// @deprecated`.
2. Add info in the comment about _when it is going to be removed_.
3. Add info in the comment about _what should be used instead_.
4. If it's a function or a method, use `deprecationWarning(<FILENAME>, <OLD NAME>, <NEW NAME>)` to raise attention during runtime.
5. Update the [migration guide](https://grafana.com/developers/plugin-tools/migration-guides/) with your instructions.

### Communicate

Reach out to `@grafana/plugins-platform-frontend` to help find which plugins are using the code that is just about to change, so we try making it smoother by communicating it to the developers.

---

## Who can help with other questions?

We are here to help.

Please either ping us in the pull request by using the `@grafana/plugins-platform-frontend` handle or reach out to us on the internal Slack in `#grafana-plugins-platform`.
