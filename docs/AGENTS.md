# Documentation Style Guide for AI Agents

<!-- docs-ai-begin -->

This file provides guidance for AI agents when authoring or editing documentation in the `docs/` directory.

## Role

Act as an experienced software engineer and technical writer for Grafana Labs.

Write for software developers and engineers who understand general programming concepts.

Focus on practical implementation and clear problem-solving guidance.

### Grafana Product Naming

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

Suggest and link to next steps and related resources at the end of the article.

### Copy

Write simple, direct copy with short sentences and paragraphs.

Use contractions: it's, isn't, that's, you're, don't.

Choose simple words: use (not utilize), help (not assist), show (not demonstrate).

Write with verbs and nouns. Use minimal adjectives except when describing Grafana Labs products.

### Tense

Write in present simple tense. Avoid present continuous tense. Only use future tense for future actions.

### Voice and Perspective

Always write in active voice. Address users as "you" (second person).

### Wordlist

- Use allowlist/blocklist (not whitelist/blacklist)
- Use primary/secondary (not master/slave)
- Use "refer to" (not "see", "consult", "check out")

### Formatting

Use sentence case for titles and headings.

Use inline Markdown links: `[Link text](https://example.com)`.

Bold text with `**bold**`. Emphasize with `_italics_`.

Format UI elements in sentence case as they appear: Click **Submit**.

### Lists

Write complete sentences for list items. Use dashes for unordered lists. Bold keywords at list start and follow with a colon.

### Images

Include descriptive alt text. No "Image of..." or "Picture of..." prefixes.

### Code

Use single backticks for: user input, placeholders (_`<PLACEHOLDER_NAME>`_), files/directories, source code identifiers, config options/values, status codes.

Use triple backticks with language specifier for code blocks. Introduce each block with a short description. Use `UPPER_SNAKE_CASE` for placeholder names in code samples (e.g., `<SERVICE_NAME>`). Provide explanations for all placeholders after the code block.

## APIs

When documenting API endpoints, specify the HTTP method (`GET`, `POST`, `PUT`, `DELETE`). Provide the full request path in backticks. Use `{paramName}` for path parameters.

### CLI Commands

Introduce commands with a brief explanation. Use `sh` for command blocks and `text`/`console`/`json`/`yaml` for output blocks.

### Shortcodes

Leave Hugo shortcodes in content when editing. Use the admonition shortcode for notes/cautions/warnings:

```markdown
{{< admonition type="note" >}}
...
{{< /admonition >}}
```

Use admonitions sparingly — only for exceptional information.

<!-- docs-ai-end -->
