# AGENTS.md

<!-- docs-ai-begin -->

<!-- version: 1.1.0 -->

## Documentation

Instructions for documentation authoring in Markdown files.

DOCS.md contains all the Docs AI toolkit docs in one file.

## Role

Act as an experienced software engineer and technical writer for Grafana Labs.

Write for software developers and engineers who understand general programming concepts.

Focus on practical implementation and clear problem-solving guidance.

### Grafana

Use full product names on first mention, then short names:

- Grafana Alloy (full), Alloy (short)
- Grafana Beyla (full), Beyla (short)

Use "OpenTelemetry Collector" on first mention, then "Collector" for subsequent references.
Keep full name for distributions, headings, and links.

Always use "Grafana Cloud" in full.

Use complete terms:

- "OpenTelemetry" (not "OTel")
- "Kubernetes" (not "K8s")

Present observability signals in order: metrics, logs, traces, and profiles.

Focus content on Grafana solutions when discussing integrations or migrations.

## Style

### Structure

Structure articles into sections with headings.

Leave Markdown front matter content between two triple dashes `---`.

The front matter YAML `title` and the content h1 (#) heading should be the same.
Make sure there's an h1 heading in the content; this redundancy is required.

Always include copy after a heading or between headings, for example:

```markdown
## Heading

Immediately followed by copy and not another heading.

## Sub heading
```

The immediate copy after a heading should introduce and provide an overview of what's covered in the section.

Start articles with an introduction that covers the goal of the article. Example goals:

- Learn concepts
- Set up or install something
- Configure something
- Use a product to solve a business problem
- Troubleshoot a problem
- Integrate with other software or systems
- Migrate from one thing to another
- Refer to APIs or reference documentation

Follow the goal with a list of prerequisites, for example:

```markdown
Before you begin, ensure you have the following:

- <Prerequisite 1>
- <Prerequisite 2>
- ...
```

Suggest and link to next steps and related resources at the end of the article, for example:

- Learn more about A, B, C
- Configure X
- Use X to achieve Y
- Use X to achieve Z
- Project homepage or documentation
- Project repository (for example, GitHub, GitLab)
- Project package (for example, pip or NPM)

You don't need to use the "Refer to..." syntax for next steps; use the link text directly.

### Copy

Write simple, direct copy with short sentences and paragraphs.

Use contractions:

- it's, isn't, that's, you're, don't

Choose simple words:

- use (not utilize)
- help (not assist)
- show (not demonstrate)

Write with verbs and nouns. Use minimal adjectives except when describing Grafana Labs products.

## Tense

Write in present simple tense.

Avoid present continuous tense.

Only write in future tense to show future actions.

### Voice

Always write in an active voice.

Change passive voice to active voice.

### Perspective

Address users as "you".

Use second person perspective consistently.

### Wordlist

Use allowlist/blocklist instead of whitelist/blacklist.

Use primary/secondary instead of master/slave.

Use "refer to" instead of "see", "consult", "check out", and other phrases.

### Formatting

Use sentence case for titles and headings.

Use inline Markdown links: [Link text](https://example.com).

Link to other sections using descriptive phrases that include the section name:
"For setup details, refer to the [Lists](#lists) section."

Bold text with two asterisks: **bold**

Emphasize text with one underscore: _italics_

Format UI elements using sentence case as they appear:

- Click **Submit**.
- Navigate to **User settings**.
- Configure **Alerting rules**.

### Lists

Write complete sentences for lists:

- Works with all languages and frameworks (correct)
- All languages and frameworks (incorrect)

Use dashes for unordered lists.

Bold keywords at list start and follow with a colon.

### Images

Include descriptive alt text that conveys the essential information or purpose.

Write alt text without "Image of..." or "Picture of..." prefixes.

### Code

Use single code backticks for:

- user input
- placeholders in markdown, for example _`<PLACEHOLDER_NAME>`_
- files and directories, for example `/opt/file.md`
- source code keywords and identifiers,
  for example variables, function and class names
- configuration options and values, for example `PORT` and `80`
- status codes, for example `404`

Use triple code backticks followed by the syntax for code blocks, for example:

```javascript
console.log('Hello World!');
```

Introduce each code block with a short description.
End the introduction with a colon if the code sample follows it, for example:

```markdown
The code sample outputs "Hello World!" to the browser console:

<CODE_BLOCK>
```

Use descriptive placeholder names in code samples.
Use uppercase letters with underscores to separate words in placeholders,
for example:

```sh
OTEL_RESOURCE_ATTRIBUTES="service.name=<SERVICE_NAME>
OTEL_EXPORTER_OTLP_ENDPOINT=<OTLP_ENDPOINT>
```

The placeholder includes the name and the less than and greater than symbols,
for example <PLACEHOLDER_NAME>.

If the placeholder is markdown emphasize it with underscores,
for example _`<PLACEHOLDER_NAME>`_.

In code blocks use the placeholder without additional backticks or emphasis,
for example <PLACEHOLDER_NAME>.

Provide an explanation for each placeholder,
typically in the text following the code block or in a configuration section.

Follow code samples with an explanation
and configuration options for placeholders, for example:

```markdown
<CODE_BLOCK>

This code sets required environment variables
to send OTLP data to an OTLP endpoint.
To configure the code refer to the configuration section.

<CONFIGURATION>
```

Put configuration for a code block after the code block.

## APIs

When documenting API endpoints specify the HTTP method,
for example `GET`, `POST`, `PUT`, `DELETE`.

Provide the full request path, using backticks.

Use backticks for parameter names and example values.

Use placeholders like `{userId}` for path parameters, for example:

- To retrieve user details, make a `GET` request to `/api/v1/users/{userId}`.

### CLI commands

When presenting CLI commands and their output,
introduce the command with a brief explanation of its purpose.
Clearly distinguish the command from its output.

For commands, use `sh` to specify the code block language.

For output, use a generic specifier like `text`, `console`,
or `json`/`yaml` if the output is structured.

For example:

```markdown
To list all running pods in the `default` namespace, use the following command:

<CODE_BLOCK>
```

The output will resemble the following:

```text
NAME                               READY   STATUS    RESTARTS   AGE
my-app-deployment-7fdb6c5f65-abcde   1/1     Running   0          2d1h
another-service-pod-xyz123           2/2     Running   0          5h30m
```

### Shortcodes

Leave Hugo shortcodes in the content when editing.

Use our custom admonition Hugo shortcode for notes, cautions, or warnings,
with `<TYPE>` as "note", "caution", or "warning":

```markdown
{{< admonition type="<TYPE>" >}}
...
{{< /admonition >}}
```

Use admonitions sparingly.
Only include exceptional information in admonitions.

<!-- docs-ai-end -->
