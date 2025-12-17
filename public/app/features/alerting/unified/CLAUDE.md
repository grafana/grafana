# Alerting Squad - Claude Code Configuration

This file provides context for Claude Code when working on the Grafana Alerting codebase. It contains alerting-specific patterns and references to Grafana's coding standards.

## Project Context

**Location**: `public/app/features/alerting/unified/`
**Squad**: Alerting
**Focus**: Frontend development for Grafana's unified alerting system
**Tech Stack**: React, TypeScript, Redux Toolkit, RTK Query, Emotion, Jest, React Testing Library, MSW

## Grafana Coding Standards

**IMPORTANT**: Always follow Grafana's official style guides. Do not duplicate standards here - reference the source files:

### Required Reading

1. **Frontend Style Guide**: [../../../../../contribute/style-guides/frontend.md](../../../../../contribute/style-guides/frontend.md)
   - Naming conventions, component patterns, TypeScript, exports
   - Function declarations for components, callback props with "on" prefix

2. **Testing Guidelines**: [../../../../../contribute/style-guides/testing.md](../../../../../contribute/style-guides/testing.md)
   - React Testing Library, query priorities, user event setup

3. **Styling Guide**: [../../../../../contribute/style-guides/styling.md](../../../../../contribute/style-guides/styling.md)
   - Emotion usage, `useStyles2` hook patterns

4. **Redux Framework**: [../../../../../contribute/style-guides/redux.md](../../../../../contribute/style-guides/redux.md)
   - Redux Toolkit patterns, reducer testing

5. **Alerting Testing Guide**: [./TESTING.md](./TESTING.md)
   - MSW API mocking, permission mocking, data source setup

### Alerting-Specific Conventions

**Use @grafana/alerting Package**:

- **Always check @grafana/alerting for shared components/hooks** before creating new ones:

  ```typescript
  // Good - Use exported components/hooks from @grafana/alerting
  import { AlertLabel, alertingMatchers } from '@grafana/alerting';

  // Check what's available before reimplementing
  ```

**Layout Components**:

- **Prefer @grafana/ui layout components** over styled divs:

  ```typescript
  // Good - Use Box for simple layout/spacing
  import { Box } from '@grafana/ui';
  <Box marginLeft={1}>Content</Box>

  // Good - Use Stack for flex layouts
  import { Stack } from '@grafana/ui';
  <Stack direction="column" gap={2}>
    <div>Item 1</div>
    <div>Item 2</div>
  </Stack>

  // Avoid - Custom styled divs when layout components exist
  <div className={styles.wrapper}>Content</div>
  ```

## Alerting Codebase Structure

### Key Directories

- `api/` - RTK Query API slices for data fetching
- `components/` - Feature-specific React components organized by domain
- `hooks/` - Reusable custom hooks for logic and data fetching
- `rule-editor/` - Alert rule creation and editing forms
- `rule-list/` - Alert rules list views (v1 and v2)
- `state/` - Redux state management and context providers
- `utils/` - Utility functions and helpers
- `types/` - TypeScript type definitions
- `mocks/` - MSW mock server setup for testing
- `testSetup/` - Test utilities and configuration

### Component Domains

- `alert-groups/` - Alert grouping and filtering
- `contact-points/` - Contact point configuration
- `notification-policies/` - Notification routing policies
- `mute-timings/` - Mute timing windows
- `silences/` - Silence management
- `receivers/` - Receiver configuration
- `templates/` - Notification templates
- `permissions/` - Permission management
- `settings/` - Alertmanager settings

## State Management Patterns

### RTK Query (Primary - Preferred)

**IMPORTANT**: Our direction is to use RTK Query for data fetching, NOT Redux. Do not create new RTKQ endpoints, those should be created manually.

- API slices in `api/` directory
- Custom base query in `api/alertingApi.ts`
- Automatic caching with 2-minute polling: `RULE_LIST_POLL_INTERVAL_MS`
- Key APIs: `alertRuleApi`, `alertmanagerApi`, `prometheusApi`, `receiversApi`

**For new features**: Always use RTK Query hooks for data fetching:

```typescript
import { useGetAlertRulesQuery } from '../api/alertRuleApi';

const { data, isLoading, error } = useGetAlertRulesQuery(params);
```

### Redux Toolkit (Legacy)

**Avoid for new features** - Use RTK Query instead

- Legacy reducers exist in `state/reducers/`
- Use state selectors: `useUnifiedAlertingSelector`
- Only modify if maintaining existing Redux code

### Context Providers

- `AlertmanagerContext` - Alertmanager selection state, for managing Alertmanager entities for a specific Alertmanager data source.
- `SettingsContext` - Settings state – used in `public/app/features/alerting/unified/components/settings`
- `WorkbenchContext` - Workbench state used in the alert triage feature `public/app/features/alerting/unified/triage`

### Forms

- Use `react-hook-form` (v7) for all forms
- See `rule-editor/alert-rule-form/` for patterns

## Alerting-Specific Testing Patterns

See [./TESTING.md](./TESTING.md) for comprehensive testing guide. Key points:

### API Mocking with MSW

**REQUIRED**: Use MSW for all API mocking (not `jest.fn()`) – though it's fine to use this function for unit testing.

```typescript
import { mockApi } from '../mockApi';

// Mock common endpoints
mockApi.eval(); // for AlertingQueryRunner
// If helper doesn't exist, add it to mockApi.ts
```

**Why MSW?** Forces proper loading state handling, discovers UI issues early

### Permission Mocking

**Default: RBAC enabled** (most common user scenario)

```typescript
import { enableRBAC, grantUserPermissions } from '../mocks';

enableRBAC(); // Usually not needed, enabled by default
grantUserPermissions([AccessControlAction.AlertingRuleRead]);
```

### Mock Data Factories

Located in `mocks.ts`:

```typescript
mockDataSource();
mockPromAlert();
mockRulerGrafanaRule();
mockAlertmanagerAlert();
mockSilence();
```

### Data Source Setup

Located in `testSetup/datasources.ts` for data source mocking patterns

### Test Data Factories

**Use factories for creating test data** - Don't manually create objects.

For Kubernetes APIs and new schemas – use the `@grafana/alerting` package.

Mock factories are defined in `packages/grafana-alerting/src/grafana/api/notifications/v0alpha1/mocks/fakes`
MSW handlers in `packages/grafana-alerting/src/grafana/api/notifications/v0alpha1/mocks/handlers`

And there are "scenarios" that combine the two above. An example of such is `packages/grafana-alerting/src/grafana/contactPoints/components/ContactPointSelector/ContactPointSelector.test.scenario.ts` and is used for integration tests.

Additionally alerting uses **`alertingFactory`** from `mocks/server/db` for building test data:

```typescript
import { alertingFactory } from './mocks/server/db';
import { mockFolder } from './mocks';

// Build a single alerting rule
const alertingRuleBuilder = alertingFactory.ruler.grafana.alertingRule;
const rule = alertingRuleBuilder.build();

// Build multiple rules
const rules = alertingRuleBuilder.buildList(6);

// Override specific fields
const customRule = alertingRuleBuilder.build({
  grafana_alert: { title: 'CPU Alert' },
  labels: { severity: 'critical' },
});
```

**Common patterns**:

```typescript
// Alerting rules
alertingFactory.ruler.grafana.alertingRule.build();
alertingFactory.ruler.grafana.alertingRule.buildList(n);

// Folders
mockFolder(); // Simple mock function

// Override fields when building
alertingRuleBuilder.build({
  grafana_alert: { title: 'Custom Title' },
  labels: { key: 'value' },
});
```

**Benefits**:

- Consistent test data across tests
- Easy to generate multiple instances with `buildList(n)`
- Override only the fields you care about
- Automatic sequencing (e.g., "Alerting rule 1", "Alerting rule 2")

**Other mock functions** (from `mocks.ts`):

```typescript
mockDataSource();
mockPromAlert();
mockRulerGrafanaRule();
mockAlertmanagerAlert();
mockSilence();
mockFolder();
```

## Alerting-Specific Patterns

### Feature Toggles & settings

A full list of features can be found in `pkg/services/featuremgmt/toggles_gen.csv` – focus on feature toggles owned by `@grafana/alerting-squad`.

```typescript
import { config } from '@grafana/runtime';

if (config.featureToggles.alertingTriage) {
  // Render triage view
}
```

A common configuration setting would be `unifiedAlertingEnabled` which allows a user to configure Grafana without any alerting UI or backend enabled at all.

### Data Source Abstractions

```typescript
import { isGrafanaRulerRule } from '../utils/rules';

if (isGrafanaRulerRule(rule)) {
  // Grafana-managed
} else {
  // External alertmanager
}
```

### Access Control (RBAC)

```typescript
import { useAbilities } from '../hooks/useAbilities';

function Component() {
  const [_, { can }] = useAbilities();
  const canCreate = can(AccessControlAction.AlertingRuleCreate);

  return canCreate ? <CreateButton /> : null;
}
```

### Key Routes

Defined in `routes.tsx`:

- `/alerting` - Home
- `/alerting/list` - Rules list (v1/v2)
- `/alerting/new/:type?` - Create rule
- `/alerting/:id/edit` - Edit rule
- `/alerting/notifications` - Contact points
- `/alerting/routes` - Notification policies

### Common Hooks

```typescript
useCombinedRuleNamespaces(); // Combines Prometheus + Ruler rules
useAlertmanagerConfig(); // Fetch alertmanager config
useFolder(); // Folder operations
useUnifiedAlertingSelector(); // Redux state – avoid using
useAbilities(); // Permission checking
```

### Link URLs and Navigation

**IMPORTANT**: Different navigation components require different URL formats.

#### When to use `createRelativeUrl`

Use `createRelativeUrl` **only with LinkButton** (and other components that render HTML `<a>` elements):

```typescript
import { createRelativeUrl } from '@grafana/data';
import { LinkButton } from '@grafana/ui';

// LinkButton renders <a> tag - needs manual subpath prefix
<LinkButton href={createRelativeUrl('/alerting/list')}>
  View Rules
</LinkButton>
```

**Why?** LinkButton renders a native HTML anchor element, so it doesn't use React Router. You must manually add the subpath prefix using `createRelativeUrl`.

#### When NOT to use `createRelativeUrl`

Do **NOT** use `createRelativeUrl` with:

1. **locationService** - Automatically adds prefix:

```typescript
import { locationService } from '@grafana/runtime';

// locationService uses react-router history - prefix added automatically
locationService.push('/alerting/list'); // ✅ Correct - no createRelativeUrl
locationService.push(createRelativeUrl('/alerting/list')); // ❌ Wrong - double prefix!
```

2. **TextLink component** - Automatically adds prefix:

```typescript
import { TextLink } from '@grafana/ui';

// TextLink uses react-router Link - prefix added automatically
<TextLink href="/alerting/list">View Rules</TextLink> // ✅ Correct
<TextLink href={createRelativeUrl('/alerting/list')}>View Rules</TextLink> // ❌ Wrong
```

#### Summary

| Component/Service    | Use `createRelativeUrl`? | Reason                                  |
| -------------------- | ------------------------ | --------------------------------------- |
| `LinkButton`         | ✅ YES                   | Renders `<a>` tag (native HTML)         |
| `Button` with `href` | ✅ YES                   | Renders `<a>` tag when href provided    |
| `locationService`    | ❌ NO                    | Uses react-router history (auto-prefix) |
| `TextLink`           | ❌ NO                    | Uses react-router Link (auto-prefix)    |
| React Router `Link`  | ❌ NO                    | React Router component (auto-prefix)    |

**Rule of thumb**: If it renders a native HTML `<a>` tag, use `createRelativeUrl`. If it uses React Router, don't.

## Key Libraries

### Grafana Internal

- `@grafana/ui` - UI components (Button, Select, Input, etc.)
- `@grafana/data` - Data models and utilities
- `@grafana/runtime` - Runtime services (config, backendSrv, locationService)
- `@grafana/scenes` - Scene framework (Insights/Triage views)
- `@grafana/e2e-selectors` - Test selectors
- `@grafana/alerting` - Grafana managed alerting specific package (utility functions, API endpoints, mocks, React components, etc)

### External

- `react-hook-form` (v7) - Form state
- `@reduxjs/toolkit` - Redux + RTK Query
- `@emotion/css` - Styling
- `lodash` - Utilities
- `msw` - API mocking for tests

## Quick Reference Checklists

### Creating a New Component

1. ✅ Create in appropriate `components/` subdirectory
2. ✅ Use function declaration (not arrow function)
3. ✅ Add TypeScript props interface (no "I" prefix)
4. ✅ Use `useStyles2` for styling (Emotion)
5. ✅ Create colocated test file
6. ✅ Use MSW for API mocking in tests
7. ✅ Query with `*ByRole` queries

### Adding a New API Endpoint

1. ✅ Add to relevant API slice in `api/` (RTK Query)
2. ✅ Add helper to `mockApi.ts` for testing
3. ✅ Handle loading/error states in UI
4. ✅ Test with MSW

### Creating a New Form

1. ✅ Use `react-hook-form` (v7)
2. ✅ See `rule-editor/alert-rule-form/` for patterns
3. ✅ Add validation (schema if needed)
4. ✅ Handle API submission errors
5. ✅ Test user interactions with `userEvent`

### Writing Tests

Check https://testing-library.com/docs/queries/about/ for what selectors to prefer when using React Testing Library

- [ ] RBAC enabled by default
- [ ] MSW for API mocking (not `jest.fn()`)
- [ ] Loading states tested
- [ ] Error states tested
- [ ] User interactions use `userEvent.setup()`
- [ ] Queries prefer `*ByRole`
- [ ] Async operations use `await` and `findBy*`
- [ ] Permissions tested with `grantUserPermissions`

## Using GitHub CLI for Context

When working on issues, PRs, or needing repository context, use the GitHub CLI (`gh`) to fetch information directly:

### Common Commands

```bash
# View issue details
gh issue view <issue-number>

# View PR details and diff
gh pr view <pr-number>
gh pr diff <pr-number>

# List recent issues
gh issue list --limit 10

# List PRs with specific labels
gh pr list --label "alerting"

# Search issues
gh issue list --search "keyword"

# View PR reviews and comments
gh pr view <pr-number> --comments

# Check CI status
gh pr checks <pr-number>

# View repository info
gh repo view
```

### When to Use

- **Understanding issue context**: Fetch issue descriptions, comments, and linked PRs
- **Reviewing PR changes**: Get diffs, review comments, and CI status
- **Finding related work**: Search for similar issues or existing implementations
- **Checking project status**: List open issues/PRs for the alerting team

### Example Workflow

```bash
# Working on issue #12345
gh issue view 12345

# Check if there's an existing PR
gh pr list --search "fixes #12345"

# Review a related PR
gh pr view 67890
gh pr diff 67890
```

## Getting Help

- Check patterns in existing `components/` code
- Review test examples in `*.test.tsx` files
- Consult `mockApi.ts` for API mocking
- See `mocks.ts` for data factories
- Read [./TESTING.md](./TESTING.md) for testing details
- Review Grafana style guides (linked at top)
- Use `gh` CLI to fetch issue/PR context from GitHub

---

**Last Updated**: 2025-11-21
**Maintained By**: Alerting Squad
