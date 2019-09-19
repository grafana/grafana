# Style guide

This style guide applies to all documentation created for Grafana products.

## Contributing

This style guide is a living document. Add to it whenever a style decision is made or question is answered.

## Published guides

For all items not covered in this guide, refer to the [Microsoft Style Guide](https://docs.microsoft.com/en-us/style-guide/welcome/) and the [Chicago Manual of Style](https://www.chicagomanualofstyle.org/home.html).

## Grafana-specific style

### General

* Use active voice. Avoid passive voice.
  - Passive: The zombie was killed.
  - Active: I killed the zombie.
* Write in the imperative second person. Examples: You can do a thing. Click the panel. Shoot the zombie.
* Write in present tense.
  - Not: The panel will open.
  - Use: The panel opens.
    or
    Grafana opens the panel.

### File naming conventions

Files that are displayed in the help system should have names that are all lowercase, no spaces. Use hyphens instead of spaces. Example: glossary.md

Files that are internal references only should be all uppercase except the file extension. Example: CONTRIBUTING.md

### Headings

* Write headings in sentence case, not title case.
  - This is sentence case
  - This Is Title Case
* Task topic headings start with a verb.
  - Open a panel. Click the link. Kill the zombie.
* Concept and reference topic headings should be nouns or gerunds. Examples: Contributing to docs, Visualizations, Style guide

### Images

* Preferred format is .png
* File extension should be all lowercase.
* Preferred DPI is 72.
* Assume all graphics will be exclusively viewed on the web.
* Maximum image size is 3840px X 2160px.
* Screenshots should be readible, but not too large.

### Capitalization

* Grafana, Loki, and Prometheus are always capitalized unless part of a code block.
* `amtool` is never capitalized.
* Abbreviations are always capitalized (such as HTTP or URL)

### Word usage
Grafana products has some words, abbreviations, and slang particular to this discourse commmunity.

#### data source
Two words, not one

**Exceptions:**
* When "datasource" is used as an identifier
* When "datasource" is part of a URL
