# Plugins App

API documentation is available at http://localhost:3000/swagger?api=plugins.grafana.app-v0alpha1

## Codegen

- Go and TypeScript: `make generate`

## Plugin sync

The plugin sync pushes the plugins loaded from disk to the plugins API.

To enable, add these feature toggles in your `custom.ini`:

```ini
[feature_toggles]
pluginInstallAPISync = true
pluginStoreServiceLoading = true
```

## Bundled plugin skills

Plugins can declare bundled Markdown skills in `plugin.json`:

```json
{
  "extensions": {
    "skills": {
      "investigate-errors": {
        "path": "skills/investigate-errors/SKILL.md"
      }
    }
  }
}
```

Each key is a stable, plugin-local slug: 1–64 lowercase letters, digits, or
hyphens, starting with a letter. Consumers should qualify it with the plugin ID
to distinguish skills from different plugins. A skill can move within a package
without changing its slug.

The path is relative to the distributed plugin root and must identify a `.md`
file. Absolute paths, URLs, empty segments, and `.` or `..` segments are rejected.
Plugin authors must include the file in their built package. Titles, descriptions,
and instructions belong in the Markdown file; Grafana does not parse them.

Declarations are preserved in plugin settings and the plugins API metadata.
Files use the existing public plugin asset mechanism, so they must not contain
secrets. Declaring a skill does not activate it or grant tool permissions.
Consumers are responsible for checking plugin availability, enablement, and
access before offering a skill, and for applying their own execution policy.
