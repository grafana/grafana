# Canvas Panel Scene E2E Tests

This directory contains end-to-end tests for the Canvas panel Scene object functionality using Playwright.

## Overview

The Canvas panel Scene is a complex component that manages:

- Element rendering and layout
- User interactions (drag, resize, select)
- Element connections
- Pan and zoom functionality
- Context menus and tooltips
- Data-driven element updates

## Test Structure

The tests are organized into the following categories:

### Basic Functionality Tests

- **Canvas Panel Creation**: Tests basic canvas panel creation and rendering
- **Scene Rendering**: Verifies that the scene renders with default elements
- **Edit Mode**: Tests entering edit mode and showing moveable controls

### Element Management Tests

- **Element Addition**: Tests adding new elements to the canvas
- **Element Selection**: Tests selecting and manipulating canvas elements
- **Element Deletion**: Tests removing elements from the canvas

### User Interaction Tests

- **Context Menu**: Tests right-click context menu functionality
- **Keyboard Shortcuts**: Tests keyboard shortcuts for element manipulation
- **Tooltips**: Tests element tooltip display on hover

### Advanced Features Tests

- **Pan and Zoom**: Tests pan and zoom functionality when enabled
- **Connections**: Tests element connection drawing and management
- **Data Updates**: Tests scene updates when data changes
- **Persistence**: Tests saving and restoring scene state

## Running the Tests

### Prerequisites

1. Grafana server running on `localhost:3000`
2. Admin user credentials: `admin/admin`
3. Canvas panel plugin enabled

### Run All Canvas Tests

```bash
yarn playwright test --project canvas
```

### Run Specific Test File

```bash
yarn playwright test e2e/plugin-e2e/canvas/canvas-scene.spec.ts
```

### Run with UI Mode

```bash
yarn playwright test --project canvas --ui
```

### Run with Debug Mode

```bash
yarn playwright test --project canvas --debug
```

## Test Configuration

The canvas tests are configured in `playwright.config.ts` with:

- Chrome browser
- Admin authentication
- Desktop viewport
- Retry on failure

## Test Data-TestId Selectors

The tests rely on the following `data-testid` attributes in the Canvas panel:

- `canvas-panel`: Main canvas panel container
- `canvas-scene`: Canvas scene container
- `canvas-element`: Individual canvas elements
- `canvas-connections`: Connection lines SVG
- `canvas-tooltip`: Element tooltips
- `context-menu`: Right-click context menu

## Adding New Tests

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Include proper setup and teardown
4. Add comments explaining complex interactions
5. Use appropriate selectors and waits

## Known Limitations

- Tests assume default Grafana configuration
- Some features may be behind feature flags
- Test data-testid selectors may need to be added to the actual Canvas panel components
- Tests are designed to be resilient to UI changes but may need updates when Canvas panel structure changes

## Feature Flags

Some Canvas panel features are controlled by feature flags:

- `canvasPanelPanZoom`: Enables pan and zoom functionality

Make sure appropriate feature flags are enabled when running tests.

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout values if tests are failing due to slow loading
2. **Element Not Found**: Verify that data-testid attributes exist in the Canvas panel code
3. **Authentication Issues**: Ensure admin credentials are correct and user has appropriate permissions
4. **Feature Flag Issues**: Check that required feature flags are enabled in Grafana configuration

### Debug Tips

1. Use `--debug` flag to step through tests
2. Use `page.pause()` to pause execution and inspect the browser
3. Use `page.screenshot()` to capture screenshots at specific points
4. Check browser console for JavaScript errors

## Contributing

When contributing to these tests:

1. Ensure tests are reliable and don't depend on external factors
2. Add appropriate documentation
3. Follow the existing naming conventions
4. Test both happy path and error scenarios
5. Consider performance implications of test actions
