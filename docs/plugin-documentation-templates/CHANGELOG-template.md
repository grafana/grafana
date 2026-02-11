# Changelog

All notable changes to [Plugin Name] are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New features that have been added but not yet released

### Changed

- Changes in existing functionality

### Deprecated

- Features that will be removed in upcoming releases

### Removed

- Features that have been removed

### Fixed

- Bug fixes

### Security

- Security improvements or fixes

## [1.0.0] - 2024-01-15

### Added

- Initial release of [Plugin Name]
- Support for [feature 1]
- Support for [feature 2]
- Support for [feature 3]
- Query editor with syntax highlighting
- Configuration options for [setting]
- Documentation and examples

### Changed

- N/A (initial release)

### Fixed

- N/A (initial release)

## [0.9.0] - 2024-01-01 (Beta)

### Added

- Beta release for testing
- Basic query functionality
- Data source configuration options
- Authentication support

### Known Issues

- [Issue 1]: Description and workaround
- [Issue 2]: Description and workaround

## Example Entry Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- Feature: Description of the new feature (#PR_NUMBER)
- API: New endpoint or method added (#PR_NUMBER)

### Changed

- Breaking: Description of breaking change (#PR_NUMBER)
- Behavior: Description of changed behavior (#PR_NUMBER)
- Performance: Description of performance improvement (#PR_NUMBER)

### Deprecated

- Feature: What's deprecated and what to use instead (#PR_NUMBER)

### Removed

- Feature: What was removed and why (#PR_NUMBER)

### Fixed

- Bug: Description of the bug fix (#PR_NUMBER, fixes #ISSUE_NUMBER)
- Security: Description of security fix (CVE-XXXX-XXXXX)

### Security

- Description of security improvement (#PR_NUMBER)
```

## Version Guidelines

### Version Numbering

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR version** (X.0.0): Incompatible API changes or breaking changes
- **MINOR version** (0.X.0): New features that are backward compatible
- **PATCH version** (0.0.X): Backward compatible bug fixes

### When to Bump Versions

**MAJOR (1.0.0 → 2.0.0)**:

- Breaking changes to configuration format
- Removal of deprecated features
- Changes that require user action to upgrade
- Changes to core functionality that break existing dashboards

**MINOR (1.0.0 → 1.1.0)**:

- New features added
- New query capabilities
- New configuration options
- Performance improvements
- Deprecation notices (feature still works but will be removed)

**PATCH (1.0.0 → 1.0.1)**:

- Bug fixes
- Security fixes
- Documentation updates
- Minor UI improvements that don't add new features

## Links

[Unreleased]: https://github.com/[your-username]/[your-plugin-repo]/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/[your-username]/[your-plugin-repo]/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/[your-username]/[your-plugin-repo]/releases/tag/v0.9.0
