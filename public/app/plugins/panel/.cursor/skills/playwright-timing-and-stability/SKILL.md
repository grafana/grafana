---
name: playwright-timing-and-stability
description: Critical patterns for writing stable Playwright E2E tests in React applications. Covers timing, visibility checks, form selectors, and avoiding flaky tests. Essential reading before writing or debugging E2E tests.
compatibility: Playwright, React, Grafana UI
metadata:
  framework: playwright
  version: '1.0'
---

# Playwright Timing & Stability Best Practices

Essential patterns learned from debugging flaky E2E tests in React applications. These patterns prevent common sources of test instability.

## 🚨 Critical Pattern: Always Verify Visibility Before Interaction

### The Problem

In React apps (especially complex ones like Grafana), elements can be:

- Still rendering/mounting
- In animation states
- Conditionally rendered based on state
- Replaced/re-rendered after state changes

### The Solution

**❌ DON'T: Click immediately after selection**

```typescript
const editButton = page.getByTestId(`edit-node-${nodeId}`);
await editButton.click(); // May fail if button not ready!
```

**✅ DO: Verify visibility first, THEN interact**

```typescript
const editButton = page.getByTestId(`edit-node-${nodeId}`);
await expect(editButton).toBeVisible(); // Waits for React to finish rendering
await editButton.click(); // Now safe to interact
```

### Why This Matters for React Apps

1. **Component Mounting**: React components mount asynchronously
2. **State Updates**: State changes trigger re-renders
3. **Conditional Rendering**: Elements may not exist until state is ready
4. **Animation/Transitions**: UI libraries (like Grafana UI) use animations
5. **Portal Rendering**: Modals/dropdowns often render in React portals

### Real-World Examples

#### Pattern 1: Dynamic elements after tool activation

```typescript
const editToolButton = page.getByTestId('diagram-edit-elements');
await editToolButton.click();

const editButton = page.getByTestId(`edit-node-${nodeId}`);
await expect(editButton).toBeVisible(); // Wait for React to show edit buttons
await editButton.click();
```

#### Pattern 2: Dropdown options after select click

```typescript
const shapeSelect = page.getByTestId('node-form-shape-select');
await shapeSelect.click();
await page.waitForTimeout(TIMING.TOOL_ACTIVATE); // Grafana UI animation

const option = page.getByRole('option', { name: 'Triangle', exact: true });
await expect(option).toBeVisible(); // Wait for portal render + animation
await option.click();
```

#### Pattern 3: SVG text after diagram update

```typescript
const svg = page.getByTestId('graphviz-panel-rendered-svg').locator('svg');
const nodeText = svg.locator('text').filter({ hasText: 'Server1' });
await expect(nodeText).toBeVisible(); // Wait for Graphviz render + React update
```

#### Pattern 4: With custom timeouts for slow operations

```typescript
const editButton = page.getByTestId(options.edgeId);
await expect(editButton).toBeVisible({ timeout: 5000 }); // SVG rendering is slow
await editButton.click();
```

### When to Use This Pattern

✅ **Always use before:**

- Clicking buttons/links that appear after state changes
- Interacting with modal elements
- Selecting dropdown options
- Working with dynamically rendered lists
- Interacting with SVG elements
- Clicking elements that appear after tool activation

✅ **Use with timeouts for:**

- SVG rendering (Graphviz generation is slow: 5-10s)
- Initial page load elements
- Elements dependent on network requests

❌ **Less critical for:**

- Elements that are statically present on mount
- Elements in provisioned dashboard JSON (already rendered)
- But still recommended for consistency!

### Benefits of Explicit Visibility Checks

1. **Better error messages**: "Expected element to be visible" vs "Element not found"
2. **Explicit wait conditions**: Clear what we're waiting for
3. **Timeout control**: Can customize per-element
4. **Test readability**: Makes intent clear to future maintainers

**Core Principle**: Playwright's auto-waiting is good, but explicit visibility checks are better for React apps. `await expect(element).toBeVisible()` gives Playwright an explicit assertion to wait for, which is more reliable than implicit waits when dealing with React's asynchronous rendering lifecycle.

## 🚫 Anti-Pattern: Artificial Timeouts After Async Operations

### The Problem

Using arbitrary timeouts after form submissions, modal dismissals, or state changes:

**❌ DON'T: Wait arbitrary time and hope**

```typescript
await submitModal(page, 'Add Node');
await page.waitForTimeout(1000); // Hope SVG renders in 1 second
await page.waitForTimeout(2000); // Still flaky? Try 2 seconds!
```

This is flaky because:

- Render time varies by machine speed
- CI environments may be slower than local dev
- No guarantee the operation actually completed
- Wastes time waiting longer than necessary

### The Solution

**✅ DO: Wait for actual DOM state changes**

```typescript
await submitModal(page, 'Add Node');
await verifyModalDismissed(page, 'Add Node');

// Wait for the SVG to actually re-render with content
await page.waitForFunction(() => {
  const svg = document.querySelector('[data-testid="graphviz-panel-rendered-svg"] svg');
  return svg && svg.querySelectorAll('text').length > 0;
});
```

### Pattern: Modal Submit + DOM Update

```typescript
export async function editNode(page: Page, options: { nodeId: string; newLabel: string }) {
  const labelInput = page.getByTestId('node-edit-label-input');
  await labelInput.fill(options.newLabel);

  await submitModal(page, 'Update Node');
  await verifyModalDismissed(page, 'Edit Node');

  // Wait for SVG to re-render with the update
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="graphviz-panel-rendered-svg"] svg');
    return svg && svg.querySelectorAll('text').length > 0;
  });
}
```

### When Timeouts ARE Necessary

Only use `waitForTimeout()` for operations that genuinely require time:

```typescript
const TIMING = {
  // Browser needs time to register drag gesture
  DRAG_REGISTER: 200,

  // Grafana UI Select dropdown animation duration
  TOOL_ACTIVATE: 500,
} as const;
```

**Document these explicitly** with comments explaining why they're needed. These are rare exceptions, not the rule.

### Pattern: Wait for Function vs Timeout

```typescript
// ❌ BAD: Arbitrary timeout
await page.waitForTimeout(3000); // Random guess

// ✅ GOOD: Wait for specific condition
await page.waitForFunction(() => {
  const edges = document.querySelectorAll('[data-testid="svg-container"] g.edge');
  return edges.length === 2; // Wait for exactly 2 edges
});

// ✅ GOOD: With timeout for slow operations
await page.waitForFunction(
  () => {
    const svg = document.querySelector('svg');
    return svg && svg.innerHTML.includes('Server1');
  },
  { timeout: 10000 }
); // Graphviz rendering can be slow
```

## 🎯 Always Use data-testid for Form Inputs

### The Problem

Generic CSS selectors are unreliable in complex component libraries like Grafana UI:

**❌ DON'T: Use generic selectors**

```typescript
await page.locator('input[type="text"]').first().fill('value'); // Which input?
await page.locator('input').nth(2).fill('value'); // Brittle
await page.locator('.css-abc123 input').fill('value'); // CSS classes change
```

These fail because:

- Multiple inputs may match (visible and hidden)
- Component libraries render additional hidden inputs
- Grafana UI wraps inputs in complex DOM structures
- CSS classes are auto-generated and change
- Order of elements may change with updates

### The Solution

**✅ DO: Add data-testid to every form input**

In React component:

```typescript
export function NodeFormModal({ nodeId, onSubmit }: Props) {
  return (
    <Modal>
      <Input data-testid="node-form-id-input" value={nodeId} onChange={handleChange} />
      <Input data-testid="node-form-label-input" value={label} onChange={handleLabelChange} />
      <Select data-testid="node-form-shape-select" options={shapeOptions} />
    </Modal>
  );
}
```

In test:

```typescript
await page.getByTestId('node-form-id-input').fill('Server1');
await page.getByTestId('node-form-label-input').fill('My Server');
await page.getByTestId('node-form-shape-select').click();
```

### Naming Convention for testids

Use a consistent pattern:

```
{component}-{mode}-{field}-{element}
```

Examples:

- `node-form-id-input` - Node creation form, ID field, input element
- `node-edit-label-input` - Node edit modal, label field, input element
- `edge-form-source-select` - Edge creation form, source field, select element
- `edge-edit-label-input` - Edge edit modal, label field, input element

### When Adding testids

**Add testids to:**

- ALL form inputs (text, number, select, textarea)
- Modal trigger buttons
- Submit/cancel buttons (if not using role/name)
- Any element you'll interact with in tests

**Prefer role + name for:**

- Standard buttons: `getByRole('button', { name: 'Submit' })`
- Standard links: `getByRole('link', { name: 'Learn More' })`
- Semantic elements with clear labels

## 📝 Pattern: Grafana UI Select Components

Grafana UI Select components require special handling due to portal rendering and animations.

### Standard Pattern

```typescript
const shapeSelect = page.getByTestId('node-form-shape-select');
await shapeSelect.click();

// Wait for dropdown animation
await page.waitForTimeout(TIMING.TOOL_ACTIVATE); // 500ms

// Select option by role + name
const option = page.getByRole('option', { name: 'Triangle', exact: true });
await expect(option).toBeVisible(); // Wait for portal render
await option.click();
```

### Why This Pattern?

1. **Click to open**: Grafana Select uses click (not focus)
2. **Animation delay**: Dropdown animates open (500ms)
3. **Portal rendering**: Options render in React portal (separate DOM tree)
4. **Visibility check**: Ensure option is fully rendered before clicking
5. **Exact match**: Prevent partial string matches (`exact: true`)

### Alternative: getByText for Simple Cases

In some cases (like edit modals with fewer animations), you can use:

```typescript
const shapeSelect = page.getByTestId('node-edit-shape-select');
await shapeSelect.click();
await page.getByText('Circle', { exact: true }).click();
```

But the full pattern above is more reliable for complex scenarios.

## 🧪 Test Helper Design Patterns

### Principle: Helpers Should Be Self-Contained

**❌ DON'T: Leak timing responsibilities to caller**

```typescript
export async function createNode(page: Page, id: string) {
  await page.getByTestId('add-node-button').click();
  await page.getByTestId('node-form-id-input').fill(id);
  await submitModal(page, 'Add Node');
  // Caller has to wait for render!
}

// Test code - caller must handle waiting
await createNode(page, 'Server1');
await page.waitForTimeout(1000); // Shouldn't be test's responsibility!
```

**✅ DO: Helpers wait for their own success conditions**

```typescript
export async function createNode(page: Page, id: string) {
  await page.getByTestId('add-node-button').click();
  await page.getByTestId('node-form-id-input').fill(id);
  await submitModal(page, 'Add Node');
  await verifyModalDismissed(page, 'Add Node');

  // Wait for SVG to render the new node
  await page.waitForFunction(() => {
    const svg = document.querySelector('[data-testid="graphviz-panel-rendered-svg"] svg');
    return svg && svg.querySelectorAll('g.node').length > 0;
  });
}

// Test code - clean and reliable
await createNode(page, 'Server1');
// Can immediately make assertions or proceed to next step
```

### Pattern Structure

Every helper that modifies state should follow this pattern:

```typescript
export async function helperName(page: Page, options: Options) {
  // 1. Trigger action
  await triggerElement.click();

  // 2. Verify action started
  await verifyModalHeading(page, 'Expected Modal');

  // 3. Perform actions
  await inputElement.fill(options.value);

  // 4. Submit
  await submitModal(page, 'Submit Button');

  // 5. Verify completion
  await verifyModalDismissed(page, 'Expected Modal');

  // 6. Wait for side effects (renders, updates)
  await page.waitForFunction(() => {
    // Check for expected DOM state
    return /* condition */;
  });
}
```

## 🔄 DRY Principle: Extract Common Assertions

### The Problem

Tests that repeat the same assertions multiple times:

**❌ DON'T: Duplicate assertion logic**

```typescript
test('Test A', async ({ page }) => {
  // ... do stuff ...

  const svg = getSvg(page);
  await expect(svg.locator('g.node')).toHaveCount(3);
  await expect(svg.locator('text').filter({ hasText: 'Server1' })).toBeVisible();
  await expect(svg.locator('text').filter({ hasText: 'Server2' })).toBeVisible();
  await expect(svg.locator('g.edge')).toHaveCount(2);
});

test('Test B', async ({ page }) => {
  // ... do different stuff ...

  // Same assertions copy-pasted!
  const svg = getSvg(page);
  await expect(svg.locator('g.node')).toHaveCount(3);
  await expect(svg.locator('text').filter({ hasText: 'Server1' })).toBeVisible();
  await expect(svg.locator('text').filter({ hasText: 'Server2' })).toBeVisible();
  await expect(svg.locator('g.edge')).toHaveCount(2);
});
```

### The Solution

**✅ DO: Extract shared verification functions**

```typescript
async function verifyFinalDiagramState(page: Page) {
  const svg = getSvg(page);
  await expect(svg).toBeVisible({ timeout: 10000 });

  await expect(svg.locator('g.node')).toHaveCount(3);
  await expect(svg.locator('text').filter({ hasText: 'Server1' })).toBeVisible();
  await expect(svg.locator('text').filter({ hasText: 'Server2' })).toBeVisible();
  await expect(svg.locator('text').filter({ hasText: 'Server 3' })).toBeVisible();

  await expect(svg.locator('g.edge')).toHaveCount(2);
  await expect(svg.locator('text').filter({ hasText: 'connects' })).toBeVisible();
  await expect(svg.locator('text').filter({ hasText: 'links to' })).toBeVisible();
}

test('Test A', async ({ page }) => {
  // ... do stuff ...
  await verifyFinalDiagramState(page);
});

test('Test B', async ({ page }) => {
  // ... do different stuff ...
  await verifyFinalDiagramState(page);
});
```

### When to Extract Assertions

Extract when:

- Same assertions used in 2+ tests
- Assertions represent a meaningful "state" (e.g., "final diagram", "empty state", "error state")
- Assertions are complex (5+ lines)

Keep inline when:

- Assertions are unique to one test
- Assertions are simple (1-2 lines)
- Test-specific context makes extraction unclear

## 📚 Summary: Quick Reference

### Before Every Interaction

```typescript
await expect(element).toBeVisible();
await element.click();
```

### After Modal Submissions

```typescript
await submitModal(page, 'Button Name');
await verifyModalDismissed(page, 'Modal Name');
await page.waitForFunction(() => /* check DOM state */);
```

### For Form Inputs

```typescript
// In component:
<Input data-testid="form-field-input" />;

// In test:
await page.getByTestId('form-field-input').fill('value');
```

### For Grafana Selects

```typescript
await select.click();
await page.waitForTimeout(500); // Animation
const option = page.getByRole('option', { name: 'Value', exact: true });
await expect(option).toBeVisible();
await option.click();
```

### For SVG Content

```typescript
await page.waitForFunction(
  () => {
    const svg = document.querySelector('[data-testid="svg"] svg');
    return svg && svg.querySelectorAll('text').length > 0;
  },
  { timeout: 10000 }
); // Graphviz is slow
```

## 🎯 Key Takeaways

1. **Always verify visibility** before interacting with elements in React apps
2. **Never use arbitrary timeouts** after async operations - wait for actual DOM state
3. **Always use data-testid** for form inputs - never rely on CSS selectors or element position
4. **Document necessary timeouts** with comments explaining why they exist
5. **Make helpers self-contained** - they should wait for their own success conditions
6. **Extract common assertions** into reusable verification functions
7. **Grafana Select needs special handling** - click, wait animation, verify option visible, click option

Following these patterns will eliminate 90%+ of E2E test flakiness in React applications.
