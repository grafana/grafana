# Recommended Documentation Structure for a Generic Grafana Plugin

This document provides a suggested documentation structure for plugin developers creating data source, panel, or app plugins for Grafana. The structure follows Grafana documentation standards and best practices.

## Documentation Structure Overview

```
docs/
├── README.md                          # Quick start and overview
├── getting-started/
│   ├── installation.md                # Installation instructions
│   ├── configuration.md               # Initial setup and configuration
│   └── quick-start.md                 # Quick start guide with examples
├── concepts/
│   ├── overview.md                    # Plugin purpose and use cases
│   ├── architecture.md                # How the plugin works
│   └── terminology.md                 # Key terms and concepts
├── configuration/
│   ├── data-source-settings.md        # Data source configuration (if applicable)
│   ├── plugin-options.md              # Plugin-specific options
│   └── authentication.md              # Authentication methods
├── features/
│   ├── querying.md                    # Query editor and syntax (data sources)
│   ├── visualization-options.md       # Visualization settings (panels)
│   ├── transformations.md             # Data transformations (if applicable)
│   └── advanced-features.md           # Advanced capabilities
├── tutorials/
│   ├── first-dashboard.md             # Create your first dashboard
│   ├── common-use-cases.md            # Common scenarios and solutions
│   └── best-practices.md              # Best practices and tips
├── reference/
│   ├── api-reference.md               # API documentation (if applicable)
│   ├── configuration-reference.md     # Complete configuration options
│   ├── query-syntax.md                # Query language reference
│   └── changelog.md                   # Version history and changes
├── troubleshooting/
│   ├── common-issues.md               # Common problems and solutions
│   ├── debugging.md                   # How to debug issues
│   └── faq.md                         # Frequently asked questions
└── development/
    ├── contributing.md                # How to contribute
    ├── building.md                    # Building from source
    └── testing.md                     # Testing guidelines
```

## Detailed Documentation Structure

### 1. README.md (Root Documentation)

The README should be the entry point for users. It should include:

**Structure:**
```markdown
# [Plugin Name]

## Overview

Brief description of what the plugin does (1-2 paragraphs).

## Features

- Feature 1
- Feature 2
- Feature 3

## Prerequisites

Before you begin, ensure you have the following:

- Grafana version X.X.X or later
- [Other requirements]

## Installation

Quick installation instructions or link to detailed guide.

## Quick Start

Basic example to get started quickly.

## Documentation

Links to detailed documentation sections.

## Support

How to get help (community forum, issues, etc.).

## License

License information.
```

### 2. Getting Started Section

#### installation.md

```markdown
# Install [Plugin Name]

This guide shows you how to install [Plugin Name].

## Prerequisites

Before you begin, ensure you have the following:

- Grafana version X.X.X or later
- [Other requirements]

## Install from Grafana UI

To install the plugin from the Grafana UI:

1. In Grafana, click **Administration > Plugins and data > Plugins**.
2. Search for "[Plugin Name]".
3. Click the plugin logo.
4. Click **Install**.

## Install with Grafana CLI

To install the plugin using the Grafana CLI:

```bash
grafana-cli plugins install [plugin-id]
```

Restart Grafana after installation.

## Install from ZIP file

To install the plugin from a ZIP file:

1. Download the latest release from [GitHub releases page].
2. Unzip the file into your Grafana plugins directory.
3. Restart Grafana.

## Verify installation

To verify the plugin installed successfully:

1. Navigate to **Administration > Plugins and data > Plugins**.
2. Search for "[Plugin Name]".
3. Confirm the plugin appears with an "Installed" label.

## Next steps

- [Configure the plugin](configuration.md)
- [Quick start guide](quick-start.md)
```

#### configuration.md

```markdown
# Configure [Plugin Name]

This guide shows you how to configure [Plugin Name].

## Add a data source

To add a [Plugin Name] data source:

1. Click **Connections** in the main menu.
2. Click **Add new connection**.
3. Search for "[Plugin Name]".
4. Click **Create a [Plugin Name] data source**.

## Configure connection settings

Configure the following connection settings:

### Connection

- **Name**: Descriptive name for this data source
- **URL**: Endpoint URL for the service
- **Access**: Server (default) or Browser

### Authentication

Choose your authentication method:

- **Basic authentication**: Use username and password
- **API key**: Use an API key
- **OAuth**: Use OAuth authentication

Configure authentication details based on your selection.

### Additional settings

Configure optional settings:

- **Timeout**: Request timeout in seconds (default: 30)
- **Keep cookies**: Forward cookies from the browser to the data source

## Test the connection

After configuration:

1. Click **Save & test**.
2. Confirm you see a success message.

If the connection fails, refer to the [Troubleshooting guide](../troubleshooting/common-issues.md).

## Next steps

- [Quick start guide](quick-start.md)
- [Query syntax](../features/querying.md)
```

#### quick-start.md

```markdown
# Quick start guide

This guide helps you get started with [Plugin Name].

## Prerequisites

Before you begin, ensure you have:

- [Plugin Name] installed and configured
- A dashboard where you can add panels

## Create your first query

To create your first query:

1. Navigate to a dashboard.
2. Click **Add** > **Visualization**.
3. Select your [Plugin Name] data source.
4. In the query editor, enter: `[example query]`
5. Click **Run query**.

You should see [description of expected result].

## Customize the visualization

To customize how your data appears:

1. In the panel editor, navigate to the **Panel options** section.
2. Update the **Title** to describe your visualization.
3. In the **Visualization** section, select your preferred visualization type.
4. Configure visualization-specific options.

## Save your dashboard

To save your work:

1. Click the **Save** icon at the top.
2. Enter a name for your dashboard.
3. Click **Save**.

## Next steps

- [Common use cases](../tutorials/common-use-cases.md)
- [Query syntax reference](../reference/query-syntax.md)
- [Best practices](../tutorials/best-practices.md)
```

### 3. Concepts Section

#### overview.md

```markdown
# [Plugin Name] overview

[Plugin Name] is a [type] plugin for Grafana that allows you to [primary purpose].

## What is [Plugin Name]?

[2-3 paragraphs explaining what the plugin is and why it exists]

## Use cases

Use [Plugin Name] when you want to:

- Use case 1
- Use case 2
- Use case 3

## Key features

[Plugin Name] provides the following features:

- Feature 1: Description
- Feature 2: Description
- Feature 3: Description

## How it works

[Explanation of how the plugin works at a high level]

## Supported versions

[Plugin Name] supports:

- Grafana version X.X.X and later
- [Other version requirements]

## Next steps

- [Architecture details](architecture.md)
- [Key terminology](terminology.md)
```

#### architecture.md

```markdown
# Architecture

This document describes the architecture of [Plugin Name].

## Overview

[High-level architecture description]

## Components

### Frontend

[Description of frontend components]

### Backend (if applicable)

[Description of backend components]

### Data flow

[Explanation of how data flows through the plugin]

## Integration points

### Grafana APIs

[Plugin Name] integrates with the following Grafana APIs:

- API 1: Purpose
- API 2: Purpose

### External services

[Plugin Name] communicates with:

- Service 1: Purpose
- Service 2: Purpose

## Performance considerations

[Discussion of performance characteristics and optimization]

## Security

[Security considerations and best practices]
```

#### terminology.md

```markdown
# Terminology

This document defines key terms used in [Plugin Name] documentation.

## General terms

**Term 1**
: Definition of term 1.

**Term 2**
: Definition of term 2.

## Plugin-specific terms

**Term 3**
: Definition of term 3.

**Term 4**
: Definition of term 4.
```

### 4. Configuration Section

This section contains detailed configuration documentation for all plugin options.

### 5. Features Section

#### querying.md (for data sources)

```markdown
# Query data

This guide shows you how to query data using [Plugin Name].

## Query editor

The query editor provides the following options:

### Basic query

To create a basic query:

1. Select the data source.
2. In the query editor, enter your query.
3. Click **Run query**.

### Query syntax

[Plugin Name] uses the following query syntax:

[Detailed explanation of query syntax]

**Example queries:**

Query metrics:

```
[example query 1]
```

Filter by label:

```
[example query 2]
```

### Query options

Configure the following query options:

- **Option 1**: Description
- **Option 2**: Description

## Variables

You can use dashboard variables in queries:

```
[example with variable]
```

## Ad-hoc filters

[Plugin Name] supports ad-hoc filters for dynamic filtering.

## Next steps

- [Query syntax reference](../reference/query-syntax.md)
- [Common use cases](../tutorials/common-use-cases.md)
```

### 6. Tutorials Section

```markdown
# Common use cases

This guide shows common use cases for [Plugin Name].

## Use case 1: [Title]

[Step-by-step guide for use case 1]

## Use case 2: [Title]

[Step-by-step guide for use case 2]

## Use case 3: [Title]

[Step-by-step guide for use case 3]
```

### 7. Reference Section

#### configuration-reference.md

```markdown
# Configuration reference

This document provides a complete reference for all [Plugin Name] configuration options.

## Data source configuration

### Connection settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Name | string | (required) | Display name for the data source |
| URL | string | (required) | Service endpoint URL |
| Access | string | server | Access mode: server or browser |

### Authentication settings

[Complete table of authentication options]

### Additional settings

[Complete table of additional options]

## Plugin options

[Complete reference for plugin-specific options]
```

### 8. Troubleshooting Section

#### common-issues.md

```markdown
# Common issues

This guide helps you resolve common issues with [Plugin Name].

## Connection issues

### Issue: Cannot connect to data source

**Symptoms:**
- Error message: "[error message]"

**Possible causes:**
- Cause 1
- Cause 2

**Solutions:**

Try the following solutions:

1. Solution 1
2. Solution 2

### Issue: Authentication failed

[Similar structure for other issues]

## Query issues

[Query-related issues and solutions]

## Performance issues

[Performance-related issues and solutions]

## Next steps

- [Debugging guide](debugging.md)
- [FAQ](faq.md)
```

#### faq.md

```markdown
# Frequently asked questions

This document answers frequently asked questions about [Plugin Name].

## General questions

**Q: What is [Plugin Name]?**

A: [Answer]

**Q: Which Grafana versions are supported?**

A: [Answer]

## Installation questions

[Installation-related FAQs]

## Configuration questions

[Configuration-related FAQs]

## Usage questions

[Usage-related FAQs]
```

## Documentation Best Practices

When writing plugin documentation, follow these best practices:

### Writing style

- Use present simple tense
- Write in active voice
- Address users as "you"
- Use contractions: it's, isn't, that's, you're, don't
- Choose simple words: use (not utilize), help (not assist)
- Write short sentences and paragraphs

### Structure

- Start with an introduction explaining the goal
- List prerequisites before procedures
- Use numbered lists for sequential steps
- Use bullet lists for non-sequential items
- End with next steps and related resources

### Code examples

- Introduce code blocks with a description
- End the introduction with a colon if code follows immediately
- Use descriptive placeholder names in UPPERCASE with underscores
- Format placeholders as `<PLACEHOLDER_NAME>`
- Explain placeholders after code blocks

### Images

- Include descriptive alt text
- Don't use "Image of..." or "Picture of..." prefixes

### Links

- Use inline Markdown links: `[Link text](url)`
- Use descriptive phrases for section links
- Use "refer to" instead of "see" or "check out"

### Formatting

- Use sentence case for titles and headings
- Bold UI elements as they appear: **Submit**, **User settings**
- Use single backticks for files, directories, code keywords, and configuration options

### Admonitions

Use admonitions sparingly for exceptional information:

```markdown
{{< admonition type="note" >}}
Important note text.
{{< /admonition >}}
```

Types: note, caution, warning

## Example: Complete Documentation Set

For a complete example of plugin documentation following this structure, refer to:

- [Grafana data source plugin examples](https://github.com/grafana/grafana-plugin-examples)
- [Official Grafana plugins](https://grafana.com/grafana/plugins/)

## Maintenance

Keep documentation up to date:

- Update the changelog with every release
- Review and update configuration references
- Add new use cases and examples as they emerge
- Update troubleshooting guides based on user issues
- Keep screenshots current with the latest UI

## Resources

- [Grafana Plugin Tools](https://grafana.com/developers/plugin-tools/)
- [Plugin Development Community](https://community.grafana.com/c/plugin-development/30)
- [Grafana Documentation Style Guide](https://grafana.com/docs/writers-toolkit/)
