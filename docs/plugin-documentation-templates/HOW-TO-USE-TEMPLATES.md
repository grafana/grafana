# How to Use Plugin Documentation Templates

This guide explains how to use the documentation templates provided in this directory to create comprehensive documentation for your Grafana plugin.

## Overview

These templates provide a starting structure for plugin documentation that follows Grafana documentation standards and best practices. You can customize them to fit your specific plugin type and features.

## Quick Start

1. **Copy the templates** to your plugin repository:

```bash
cp -r plugin-documentation-templates/* your-plugin-repo/docs/
```

2. **Rename and customize** each template by replacing placeholders:
   - `[Plugin Name]` - Your plugin's display name
   - `[your-plugin-id]` - Your plugin's ID from `plugin.json`
   - `[your-username]` - Your GitHub username or organization
   - `[your-plugin-repo]` - Your plugin repository name
   - Example URLs, queries, and configurations

3. **Remove template suffixes** from filenames:
   - `README-template.md` → `README.md`
   - `INSTALLATION-template.md` → `INSTALLATION.md`
   - etc.

4. **Delete sections** that don't apply to your plugin type

5. **Add plugin-specific sections** as needed

## Template Files

### Core Documentation

These files are essential for every plugin:

| File                          | Purpose                                   | Required    |
| ----------------------------- | ----------------------------------------- | ----------- |
| `README-template.md`          | Main entry point, overview, quick start   | Yes         |
| `INSTALLATION-template.md`    | Installation instructions for all methods | Yes         |
| `CONFIGURATION-template.md`   | Configuration and setup guide             | Yes         |
| `TROUBLESHOOTING-template.md` | Common issues and solutions               | Yes         |
| `CHANGELOG-template.md`       | Version history and changes               | Yes         |
| `QUICK-START-template.md`     | Quick start guide with examples           | Recommended |

### Additional Documentation

Create additional files based on your plugin type and features:

**For Data Source Plugins:**

- `QUERYING.md` - Query editor and syntax
- `QUERY-SYNTAX-REFERENCE.md` - Complete query language reference
- `AUTHENTICATION.md` - Authentication methods and setup
- `DATA-TRANSFORMATION.md` - Data transformation features

**For Panel Plugins:**

- `VISUALIZATION-OPTIONS.md` - Panel configuration options
- `CUSTOMIZATION.md` - Customization and styling
- `DATA-HANDLING.md` - How the panel processes data

**For App Plugins:**

- `FEATURES.md` - Overview of app features
- `NAVIGATION.md` - How to navigate the app
- `INTEGRATIONS.md` - Integration with other plugins or services

**Common Optional Files:**

- `FAQ.md` - Frequently asked questions
- `CONTRIBUTING.md` - Contribution guidelines
- `DEVELOPMENT.md` - Development setup and guidelines
- `API-REFERENCE.md` - API documentation
- `BEST-PRACTICES.md` - Usage best practices
- `EXAMPLES.md` - Practical examples and use cases
- `MIGRATION-GUIDE.md` - Migration from older versions

## Customization by Plugin Type

### Data Source Plugin

For data source plugins, focus on:

1. **Connection configuration** - How to connect to the data source
2. **Authentication** - All supported authentication methods
3. **Query syntax** - Detailed query language documentation
4. **Query editor** - How to use the query editor UI
5. **Variable support** - How to use variables in queries
6. **Data transformation** - Any data transformation features

**Essential files**:

- README.md
- INSTALLATION.md
- CONFIGURATION.md
- QUERYING.md
- QUERY-SYNTAX-REFERENCE.md
- TROUBLESHOOTING.md
- CHANGELOG.md

**Example structure**:

```
docs/
├── README.md
├── INSTALLATION.md
├── CONFIGURATION.md
├── QUERYING.md
├── QUERY-SYNTAX-REFERENCE.md
├── AUTHENTICATION.md
├── TROUBLESHOOTING.md
├── FAQ.md
├── CHANGELOG.md
└── examples/
    ├── basic-queries.md
    ├── advanced-queries.md
    └── dashboard-examples.json
```

### Panel Plugin

For panel plugins, focus on:

1. **Visualization options** - All available configuration options
2. **Data requirements** - Expected data format and structure
3. **Customization** - How to customize appearance
4. **Interactivity** - Interactive features (if any)
5. **Use cases** - When to use this panel type

**Essential files**:

- README.md
- INSTALLATION.md
- CONFIGURATION.md
- VISUALIZATION-OPTIONS.md
- TROUBLESHOOTING.md
- CHANGELOG.md

**Example structure**:

```
docs/
├── README.md
├── INSTALLATION.md
├── CONFIGURATION.md
├── VISUALIZATION-OPTIONS.md
├── DATA-FORMAT.md
├── CUSTOMIZATION.md
├── TROUBLESHOOTING.md
├── EXAMPLES.md
├── CHANGELOG.md
└── images/
    ├── screenshot-1.png
    ├── screenshot-2.png
    └── demo.gif
```

### App Plugin

For app plugins, focus on:

1. **Features overview** - What the app provides
2. **Navigation** - How to navigate the app interface
3. **Configuration** - App settings and options
4. **Included components** - Data sources, panels, dashboards included
5. **Permissions** - Required permissions and RBAC

**Essential files**:

- README.md
- INSTALLATION.md
- CONFIGURATION.md
- FEATURES.md
- NAVIGATION.md
- TROUBLESHOOTING.md
- CHANGELOG.md

**Example structure**:

```
docs/
├── README.md
├── INSTALLATION.md
├── CONFIGURATION.md
├── FEATURES.md
├── NAVIGATION.md
├── INTEGRATIONS.md
├── PERMISSIONS.md
├── TROUBLESHOOTING.md
├── CHANGELOG.md
└── tutorials/
    ├── getting-started.md
    ├── common-workflows.md
    └── advanced-features.md
```

## Writing Style Guidelines

Follow these guidelines when customizing templates:

### Tone and Voice

- Use present simple tense (not future or continuous)
- Write in active voice
- Address users as "you" (second person)
- Use contractions: it's, isn't, don't, you're
- Choose simple words: use (not utilize), help (not assist)

### Structure

- Start with an introduction explaining the goal
- List prerequisites before procedures
- Use numbered lists for sequential steps
- Use bullet lists for non-sequential items
- End with next steps or related resources

### Formatting

- Use sentence case for headings
- Bold UI elements as they appear: **Save**, **Administration**
- Use backticks for code, file names, paths, and placeholders: `code`, `files.txt`, `/path/to/file`
- Format placeholders as `<PLACEHOLDER_NAME>` in uppercase with angle brackets
- Use single backticks for inline code and triple backticks for code blocks
- Specify the language after opening triple backticks: ```sh, ```yaml, ```json

### Code Examples

- Always introduce code with a description
- End the introduction with a colon if code follows immediately  
- Use descriptive placeholder names in UPPERCASE with angle brackets: `<PLACEHOLDER_NAME>`
- Explain placeholders after code blocks with specific examples
- Show realistic examples that users can copy and modify
- Use `sh` for shell commands, specify language for code blocks

**Example**:

````markdown
To configure the API endpoint, set the following environment variable:

```sh
export API_ENDPOINT="<API_ENDPOINT>"
```
````

Replace `<API_ENDPOINT>` with your actual API endpoint URL, for example `https://api.example.com`.

````

### Links

- Use inline Markdown links: `[Link text](url)`
- Use descriptive link text that includes the section or document name, not "click here" or "this page"
- Use "refer to" instead of "see", "check out", or "consult"
- Link to sections using descriptive phrases: "For setup details, refer to the [Installation](#installation) section"

**Good**: Refer to the [Configuration guide](configuration.md) for connection details.
**Better**: For connection details, refer to the [Configuration guide](configuration.md).
**Bad**: For more info, see [this page](configuration.md).

### Admonitions

Use admonitions (notes, cautions, warnings) sparingly for exceptional information only. Grafana documentation uses Hugo shortcodes for admonitions:

**Note** - For helpful additional information:

```markdown
{{< admonition type="note" >}}
This feature is available in Grafana 9.0 and later.
{{< /admonition >}}
```

**Caution** - For important warnings about potential issues:

```markdown
{{< admonition type="caution" >}}
Enabling this option may impact query performance.
{{< /admonition >}}
```

**Warning** - For critical warnings about breaking changes or data loss:

```markdown
{{< admonition type="warning" >}}
This operation can't be undone. Back up your data before proceeding.
{{< /admonition >}}
```

Use admonitions only when:
- Information is exceptional and not part of the normal flow
- Users need to be aware of important implications
- There's a risk of data loss or system issues

Don't use admonitions for:
- General information that belongs in regular text
- Repeating information already stated
- Every configuration option or feature

## Screenshots and Images

Include screenshots to help users:

1. **When to add screenshots**:
   - Configuration screens
   - Query editor UI
   - Example visualizations
   - Complex UI workflows

2. **Screenshot guidelines**:
   - Use a clean, focused screenshot
   - Highlight important areas if needed
   - Use consistent Grafana theme (light or dark)
   - Keep file size reasonable (< 500KB)
   - Use descriptive filenames

3. **Alt text**:
   - Always include descriptive alt text that conveys the essential information
   - Write alt text without "Image of...", "Picture of...", or "Screenshot of..." prefixes
   - Describe what the image shows and its purpose

**Example**:

```markdown
![Data source configuration page with connection settings filled](images/configuration.png)
```

**Good alt text examples**:
- `Query editor showing basic syntax example`
- `Dashboard with time series panels displaying CPU metrics`
- `Authentication settings page with API key field highlighted`

**Bad alt text examples**:
- `Image of query editor`
- `Screenshot of dashboard`
- `Picture showing authentication settings``

## Examples and Use Cases

Include practical examples throughout documentation:

1. **Basic examples** - Simple, common use cases
2. **Advanced examples** - Complex scenarios
3. **Complete dashboards** - Full dashboard JSON
4. **Code snippets** - Reusable configuration

**Tips for examples**:

- Make examples copy-pastable
- Use realistic data and scenarios
- Explain what each example does
- Show expected output
- Include troubleshooting tips

## Documentation Testing

Before publishing your documentation:

1. **Technical review**:
   - Test all instructions yourself
   - Verify all code examples work
   - Check all links are valid
   - Ensure screenshots are current

2. **Content review**:
   - Check for typos and grammar
   - Verify technical accuracy
   - Ensure consistent terminology
   - Check formatting is correct

3. **User testing**:
   - Have someone follow the quick start guide
   - Get feedback on clarity
   - Identify missing information
   - Find confusing sections

## Maintenance

Keep documentation up to date:

1. **Update with releases**:
   - Update CHANGELOG.md for every release
   - Update screenshots if UI changes
   - Add new features to documentation
   - Update version numbers

2. **Monitor issues**:
   - Watch for common user questions
   - Add FAQs based on issues
   - Improve troubleshooting guide
   - Clarify confusing sections

3. **Regular reviews**:
   - Review documentation quarterly
   - Check for outdated information
   - Update examples and best practices
   - Verify all links still work

## Publishing Documentation

### In Repository

Place documentation in your plugin repository:

```
your-plugin-repo/
├── README.md (overview with quick start)
├── docs/
│   ├── INSTALLATION.md
│   ├── CONFIGURATION.md
│   ├── TROUBLESHOOTING.md
│   └── ...
├── CHANGELOG.md
└── ...
```

### On Grafana.com

For plugins published on Grafana.com:

1. The main `README.md` appears on the plugin page
2. Additional docs can link to your repository
3. Consider hosting full docs separately

### Separate Documentation Site

For complex plugins, consider a dedicated documentation site:

- Use static site generators (Hugo, MkDocs, Docusaurus)
- Host on GitHub Pages, Netlify, or similar
- Organize by version for easier maintenance
- Include search functionality

## Resources

- [Grafana Documentation Style Guide](https://grafana.com/docs/writers-toolkit/)
- [Grafana Plugin Development Guide](https://grafana.com/developers/plugin-tools/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)

## Questions?

If you have questions about using these templates:

- Review the [recommended documentation structure](../recommended-plugin-doc-structure.md)
- Ask in the [Grafana Community](https://community.grafana.com/c/plugin-development/30)
- Check [Grafana plugin examples](https://github.com/grafana/grafana-plugin-examples)
