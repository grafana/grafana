# Create a feature request

Feature requests help us understand what you need from Grafana. This document guides you through writing effective feature requests that help maintainers understand your needs and prioritize improvements.

## Before you begin

We're excited to hear your ideas! Before you submit a feature request, consider these resources:

- Read the [Code of Conduct](../CODE_OF_CONDUCT.md) to understand our community guidelines.
- Search [existing feature requests](https://github.com/grafana/grafana/issues?q=is%3Aissue+is%3Aopen+label%3Atype%2Ffeature-request) to see if someone already suggested something similar.
- Discuss your idea in the [Grafana community forums](https://community.grafana.com/) to refine it and gather feedback.

## Your first feature request

When you're ready to submit a feature request, use the [feature request template](https://github.com/grafana/grafana/issues/new?template=1-feature_requests.md). The template has three sections that help maintainers understand what you need and why.

Here's an [example of how all three sections work together in an actual feature request](https://github.com/grafana/grafana/issues/105298) from the Grafana community. We'll analyze each section based on this example feature request.

### Why is this needed

This section describes the real problem or limitation you're facing.

Explain what's difficult, inefficient, or impossible with the current implementation. Focus on the problem rather than proposing a solution. This helps maintainers understand your use case and potentially find better solutions.

**What to include:**

- The specific problem or pain point you're experiencing
- How the current behavior falls short for your workflow
- Why this matters to you and your work
- A concrete example that clarifies the issue (optional but helpful)

**What to avoid:**

- Jumping directly to the solution (save that for the next section)
- Vague statements like "it would be nice if..."
- Assuming maintainers know your context or workflow

**Example of a strong answer:**

```
When using a datasource variable in dashboards and using the "Export" feature in a dashboard,
this will automatically create an input for the datasource(s) being used, but it will also
effectively override the use of the datasource variable in all panels.

This makes a confusing
experience when importing the dashboard, because users are prompted for an input, but the
selected datasource won't be reflected in the datasource variable, and any changes to the
datasource variable will not have any effect on the dashboard.
```

**Example of a weak answer:**

```
Dashboard export doesn't work well with variables.
```

The first example clearly explains what's broken, why it's confusing, and what the specific consequences are. The second example is too vague and doesn't explain the actual problem.

### What would you like to be added

This section describes what you want Grafana to do differently.

Be specific and concrete about the expected behavior. If you're suggesting a UI change, describe the interaction or include a screenshot or sketch. If it's data or API related, provide an example query or expected output.

**What to include:**

- Exactly what behavior you expect
- How the feature should work in practice
- Examples, screenshots, or code snippets that illustrate your idea
- Expected output or results

**What to avoid:**

- Vague or abstract descriptions
- Multiple unrelated features in one request (create separate requests instead)
- Implementation details unless they're critical to your request

**Example of a strong answer:**

```
Ideal behavior here would be that when using the export feature, either:

1. No inputs section is created for datasource types that are used as datasource variables.
2. IF an input is created, it should only be used to replace the currently selected value of
   the datasource variable, rather than override the datasource in panels.
```

**Example of a weak answer:**

```
Fix the dashboard export feature.
```

The first example provides clear, actionable options for how the feature should work. The second example is too vague and doesn't specify what the fix should do.

### Who is this feature for?

This section describes who benefits from this feature and in what context.

Help maintainers understand the scope and impact of your request. Be specific about user types, workflows, or scenarios where this feature matters.

**What to include:**

- The type of user who needs this (for example, Tempo users, dashboard editors, plugin developers)
- Whether this affects all Grafana users or only those using specific features or data sources
- The workflow or use case this feature improves (optional but helpful)

**What to avoid:**

- Saying "everyone" without clarifying who actually needs it
- Being overly narrow if the feature has broader appeal

**Example of a strong answer:**

```
Any Grafana Dashboard users or authors that use datasource variables.
```

**Example of a weak answer:**

```
Dashboard users.
```

The first example identifies the specific users and the feature they use (datasource variables). The second example is too generic and doesn't clarify which users or workflow are affected.

## Best practices for feature requests

Follow these guidelines to increase the chances of your feature request being accepted:

### Keep it focused

Request one feature at a time. If you have multiple ideas, create separate feature requests for each one. This makes it easier to discuss, prioritize, and implement each feature independently.

### Research first

Before submitting, search for similar requests. If you find an existing request that's close to your idea, add your use case and context to that discussion instead of creating a duplicate.

### Provide context

The more context you provide, the better maintainers can understand your needs. Include:

- Your environment or setup (which data sources, plugins, or features you're using)
- Your workflow or process
- Why this matters to you
- Any workarounds you've tried

### Be open to alternatives

Maintainers might suggest different approaches to solve your problem. Be open to these alternatives as they might be easier to implement or more maintainable in the long term.

### Stay engaged

After submitting your feature request, monitor the discussion. Answer questions from maintainers and provide clarification when needed. This helps move your request forward.

## Contributing the feature yourself

If you want to implement the feature yourself, feel free to create a pull request following the [pull request guidelines](create-pull-request.md).

We welcome community contributions and appreciate your help making Grafana better!
