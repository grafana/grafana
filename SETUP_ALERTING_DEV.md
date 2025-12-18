# Alerting Frontend Development Setup Guide

This guide will help you set up your local development environment for working on the alerting frontend.

## Prerequisites

### 1. Install Node.js (v24.11.0)

The project requires Node.js v24.11.0. We recommend using a version manager:

**Using nvm (recommended):**

```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js v24.11.0
nvm install 24.11.0
nvm use 24.11.0
```

**Using Homebrew (macOS):**

```bash
brew install node@24
```

**Verify installation:**

```bash
node --version  # Should show v24.11.0
```

### 2. Enable Corepack and Install Yarn

Grafana uses Yarn v4 managed via Corepack:

```bash
# Enable corepack (comes with Node.js)
corepack enable

# Install yarn (will use version from package.json)
corepack install
```

**Verify installation:**

```bash
yarn --version  # Should show 4.11.0
```

### 3. Install Go (if not already installed)

You need Go to run the backend server. Check `go.mod` for the minimum version.

**macOS:**

```bash
brew install go
```

**Verify installation:**

```bash
go version
```

### 4. Install GCC (required for Cgo dependencies)

**macOS:**

```bash
brew install gcc
```

## Setup Steps

### Step 1: Install Frontend Dependencies

```bash
cd /Users/rodrigo/Grafana/grafana
yarn install --immutable
```

> **Note:** If you get a checksum error, you can work around it temporarily:
>
> ```bash
> YARN_CHECKSUM_BEHAVIOR=update yarn install --immutable
> ```

### Step 2: Set Up Precommit Hooks (Recommended)

Precommit hooks help catch linting and formatting issues before you commit:

```bash
make lefthook-install
```

To remove them later:

```bash
make lefthook-uninstall
```

### Step 3: Configure Development Mode

Create a `conf/custom.ini` file to enable development mode:

```bash
echo "app_mode = development" > conf/custom.ini
```

### Step 4: Start the Development Servers

You'll need **two terminal windows** running simultaneously:

**Terminal 1 - Frontend (with hot reload):**

```bash
yarn start
```

This will:

- Generate SASS theme files
- Build all external plugins
- Build frontend assets
- Watch for changes and rebuild automatically

**Terminal 2 - Backend:**

```bash
make run
```

This will:

- Compile the Go source code
- Start the Grafana web server at `http://localhost:3000/`

### Step 5: Access Grafana

1. Open your browser to `http://localhost:3000/`
2. Log in with default credentials:
   - Username: `admin`
   - Password: `admin`
3. You'll be prompted to change the password on first login

## Testing Setup

### Run Frontend Tests

To run all frontend tests (Jest):

```bash
yarn test
```

To run tests in watch mode (recommended for development):

```bash
yarn test
# Jest will run in watch mode by default
```

To run tests for a specific file:

```bash
yarn test path/to/your/test/file.test.tsx
```

### Alerting-Specific Testing

The alerting feature uses **MSW (Mock Service Worker)** for API mocking. Key files:

- **Mock API helpers**: `public/app/features/alerting/unified/mockApi.ts`
- **Test setup**: `public/app/features/alerting/unified/testSetup/`
- **Mock factories**: `public/app/features/alerting/unified/mocks.ts`

**Key Testing Patterns:**

1. **Use MSW for API mocking** (not `jest.fn()`):

   ```typescript
   import { mockApi } from '../mockApi';
   mockApi.eval(); // Mock common endpoints
   ```

2. **RBAC is enabled by default** in tests:

   ```typescript
   import { enableRBAC, grantUserPermission } from '../mocks';
   grantUserPermission(AccessControlAction.AlertingRuleRead);
   ```

3. **Use mock factories** for test data:
   ```typescript
   import { mockDataSource, mockPromAlert } from '../mocks';
   ```

See `public/app/features/alerting/unified/TESTING.md` for detailed testing guidelines.

### Run Backend Tests

```bash
go test -v ./pkg/...
```

## Optional: Set Up Test Data Sources

To test alerting features, you may want to set up data sources:

1. Navigate to the devenv directory:

   ```bash
   cd devenv
   ```

2. Run the setup script:

   ```bash
   ./setup.sh
   ```

3. Start required data sources (e.g., Loki, Prometheus):
   ```bash
   cd ..
   make devenv sources=loki,prometheus
   ```

This creates data sources prefixed with `gdev-` and sample dashboards.

## Development Workflow

### Making Changes

1. **Frontend changes**: Edit files in `public/app/features/alerting/unified/`
   - The `yarn start` process will automatically rebuild on file changes
   - Refresh your browser to see changes

2. **Backend changes**: Edit Go files in `pkg/` or `apps/`
   - The `make run` process will automatically recompile and restart

### Running Tests While Developing

Keep a terminal open with:

```bash
yarn test
```

Jest will watch for changes and re-run relevant tests automatically.

## Troubleshooting

### "Too many open files" error

Increase the file limit:

```bash
ulimit -S -n 8000
```

Add to your `~/.zshrc` to make it permanent:

```bash
echo "ulimit -S -n 8000" >> ~/.zshrc
```

### "System limit for number of file watchers reached"

**macOS:**

```bash
sudo sysctl -w kern.maxfiles=524288
```

### JavaScript heap out of memory

Increase Node.js memory:

```bash
export NODE_OPTIONS="--max-old-space-size=8192"
```

### TypeScript errors after pulling updates

Clear the TypeScript build info cache:

```bash
rm tsconfig.tsbuildinfo
yarn start
```

## Next Steps

- Read the [Alerting Testing Guide](public/app/features/alerting/unified/TESTING.md)
- Review [Frontend Style Guide](contribute/style-guides/frontend.md)
- Check [Testing Guidelines](contribute/style-guides/testing.md)
- Explore the [Alerting Code Structure](public/app/features/alerting/unified/CLAUDE.md)

## Quick Reference

| Command              | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `yarn start`         | Start frontend dev server with hot reload |
| `make run`           | Start backend server                      |
| `yarn test`          | Run frontend tests (watch mode)           |
| `yarn test:coverage` | Run tests with coverage report            |
| `yarn lint`          | Run linter                                |
| `yarn lint:fix`      | Fix linting issues                        |
| `yarn typecheck`     | Run TypeScript type checking              |
