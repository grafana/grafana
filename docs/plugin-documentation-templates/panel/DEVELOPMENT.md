# Development

This guide explains how to set up a development environment and contribute to [plugin name].

## Prerequisites

Before you begin development, ensure you have:

- Grafana version [minimum version] or later
- Node.js LTS version
- npm or yarn package manager
- Git
- Docker and Docker Compose (optional, for local Grafana instance)

## Set up the development environment

To set up your development environment:

1. Clone the repository:

   ```sh
   git clone https://github.com/org/plugin-name.git
   cd plugin-name
   ```

1. Install dependencies:

   ```sh
   npm install
   ```

1. Build the plugin:

   ```sh
   npm run dev
   ```

   This command builds the plugin and watches for changes.

## Run Grafana locally

You can run Grafana locally using Docker Compose:

1. Start Grafana:

   ```sh
   docker compose up
   ```

1. Open Grafana in your browser at [http://localhost:3000](http://localhost:3000).

1. Sign in with the default credentials:
   - Username: `admin`
   - Password: `admin`

The plugin is automatically mounted in the local Grafana instance.

## Project structure

The project follows the standard Grafana plugin structure:

```
plugin-name/
├── src/
│   ├── components/      # React components
│   ├── types.ts         # TypeScript type definitions
│   ├── module.ts        # Plugin entry point
│   └── plugin.json      # Plugin metadata
├── pkg/                 # Backend code (if applicable)
├── docs/                # Documentation
├── tests/               # Test files
└── package.json         # NPM dependencies
```

### Key files

- **src/module.ts** - Plugin entry point that exports the PanelPlugin class
- **src/plugin.json** - Plugin metadata and configuration
- **src/types.ts** - TypeScript interfaces for plugin options
- **src/components/** - React components for the panel

## Development workflow

1. Make changes to the source code.
1. The plugin automatically rebuilds when you save changes.
1. Refresh Grafana in your browser to see the changes.

### Add the panel to a dashboard

To test your changes:

1. Navigate to a dashboard or create a new one.
1. Click **Add** > **Visualization**.
1. Select **TestData DB** as the data source.
1. Search for "[plugin name]" in the visualization picker and select it.
1. Configure the panel and verify your changes.

Alternatively, use the provisioned sample dashboard if available.

## Plugin architecture

### Panel component

The main panel component receives props from Grafana:

```typescript
interface Props extends PanelProps<SimpleOptions> {}

export const SimplePanel: React.FC<Props> = ({ options, data, width, height }) => {
  // Your panel implementation
};
```

### PanelProps interface

The PanelProps interface provides:

- `options` - Panel configuration options
- `data` - Data frames from queries
- `width` - Panel width in pixels
- `height` - Panel height in pixels
- `timeRange` - Current time range
- `timeZone` - Current time zone
- `onOptionsChange` - Callback to update options
- `fieldConfig` - Field configuration
- `replaceVariables` - Function to interpolate variables

### Panel options

Define panel options in `src/types.ts`:

```typescript
export interface SimpleOptions {
  text: string;
  showSeriesCount: boolean;
  seriesCountSize: SeriesSize;
}
```

Register options in `src/module.ts`:

```typescript
export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel)
  .setPanelOptions((builder) => {
    return builder
      .addTextInput({
        path: 'text',
        name: 'Simple text option',
        defaultValue: 'Default value',
      })
      .addBooleanSwitch({
        path: 'showSeriesCount',
        name: 'Show series count',
        defaultValue: false,
      });
  });
```

## Testing

### Run unit tests

```sh
npm run test
```

### Run end-to-end tests

```sh
npm run e2e
```

### Manual testing

Use the TestData DB data source for manual testing:

1. Create a panel with the TestData DB data source.
1. Select a scenario that provides suitable test data.
1. Verify the panel renders correctly with the test data.

## Linting and formatting

Run linting:

```sh
npm run lint
```

Fix linting issues automatically:

```sh
npm run lint:fix
```

Format code:

```sh
npm run format
```

## Building for production

To build the plugin for production:

```sh
npm run build
```

The build output is in the `dist/` directory.

## Sign the plugin

Grafana requires plugins to be signed for installation. To sign your plugin:

1. Generate a plugin signing key following the [Grafana documentation](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/).

1. Sign the plugin:

   ```sh
   npx @grafana/sign-plugin@latest
   ```

## Contribute to the project

To contribute to [plugin name]:

1. Fork the repository.
1. Create a feature branch:

   ```sh
   git checkout -b feature/your-feature-name
   ```

1. Make your changes and commit them:

   ```sh
   git commit -m "Add your feature"
   ```

1. Push to your fork:

   ```sh
   git push origin feature/your-feature-name
   ```

1. Open a pull request with a description of your changes.

### Contribution guidelines

- Follow the existing code style.
- Add tests for new features.
- Update documentation as needed.
- Ensure all tests pass before submitting.
- Write clear commit messages.

## Debugging

### Enable debug mode

Set the following in your Grafana configuration:

```ini
[log]
level = debug
```

### Debug in the browser

Use browser developer tools to debug the panel:

1. Open the browser's developer console.
1. Set breakpoints in your TypeScript code.
1. Reload the panel to hit breakpoints.

Source maps are enabled in development mode for easier debugging.

### Check plugin logs

View Grafana logs to troubleshoot plugin issues:

```sh
docker compose logs -f grafana
```

## Release process

To release a new version:

1. Update the version in `package.json` and `src/plugin.json`.
1. Update [CHANGELOG.md](CHANGELOG.md) with release notes.
1. Create a Git tag:

   ```sh
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

1. Build and sign the plugin.
1. Create a GitHub release with the build artifacts.

## Resources

- [Grafana plugin development documentation](https://grafana.com/developers/plugin-tools/)
- [Panel plugin tutorial](https://grafana.com/tutorials/build-a-panel-plugin/)
- [Grafana UI components](https://developers.grafana.com/ui/)
- [Project repository](https://github.com/org/plugin-name)
- [Report issues](https://github.com/org/plugin-name/issues)

## Get help

- [Grafana Community Forums](https://community.grafana.com/c/plugin-development/30)
- [GitHub Discussions](https://github.com/grafana/plugin-tools/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/grafana)
