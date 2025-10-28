# Design Decisions - Frontend Impact

This document summarizes all design decisions from the Single Alert Manager migration project that impact the **frontend**.

---

## Decision 01: Support references across configurations

### **Decision:**

UI will **NOT** allow users to reference staged receivers in Routes and Rules.

### **Frontend Changes:**

#### **Contact Points List**

```tsx
// Show staged receivers but with visual indication
<ContactPoint
  name="Slack from Mimir"
  isStaged={true} // ← Backend provides this
  badges={[<Badge text="Staged" color="blue" />]}
/>
```

#### **Routes / Rules Receiver Selector**

```tsx
// Disable staged receivers from selection
<Select
  options={receivers.map((r) => ({
    value: r.name,
    label: r.name,
    isDisabled: r.isStaged, // ← Disable staged
  }))}
/>;

// Show tooltip explaining why disabled
{
  receiver.isStaged && <Tooltip content="Configuration needs to be committed before this resource can be used" />;
}
```

#### **Label-based Routing**

- ✅ **Still allowed** - doesn't require direct reference
- No changes needed

### **API Contract:**

Backend must provide `isStaged` boolean in receiver objects.

---

## Decision 02: Enforce unique receiver names

### **Decision:**

Names are kept separate until commit. Mimir receivers are renamed automatically if name collision occurs.

### **Frontend Changes:**

#### **Contact Points with Name Collision**

```tsx
// Show warning if staged receiver has collision
{
  receiver.isStaged && receiver.willBeRenamed && (
    <Alert severity="warning">
      This receiver will be renamed to "{receiver.suggestedName}" on commit due to name collision with existing Grafana
      receiver.
    </Alert>
  );
}
```

#### **Staged Receiver Badge**

```tsx
// If it will be renamed, show in badge
<Badge text={receiver.willBeRenamed ? 'Staged (will rename)' : 'Staged'} color="orange" />
```

### **API Contract:**

Backend should provide:

- `willBeRenamed`: boolean
- `suggestedName`: string (optional, name after commit)

### **Impact:**

- ℹ️ **Informational only** - backend handles renaming automatically
- Frontend just displays warning/information

---

## Decision 03: Permission management for staged receivers

### **Decision:**

No granular permissions for staged receivers. Only users with wildcard permissions can see them.

### **Frontend Changes:**

#### **Hide Permissions Button**

```tsx
// In Contact Points list/detail page
{
  !receiver.isStaged && (
    <Button icon="lock" onClick={() => openPermissionsModal(receiver)}>
      Permissions
    </Button>
  );
}
```

#### **Tooltip for Staged Receivers**

```tsx
{
  receiver.isStaged && <Tooltip content="Permissions can only be managed after committing the configuration" />;
}
```

### **Files to Modify:**

- Contact Points list page
- Contact Point detail/edit page
- Any place where "Permissions" button appears

### **Impact:**

- ❌ **Hide** "Permissions" button for staged receivers
- ℹ️ **Tooltip** explains limitation

---

## Decision 04: Versioned receivers and templates

### **Decision:**

- Mimir templates (v0mimir1/v0mimir2) → Only usable in v0 integrations
- Grafana templates (v1) → Only usable in v1 integrations

### **Frontend Changes:**

#### **Template Selector / Autocomplete**

```tsx
// Filter templates based on integration version
const availableTemplates = allTemplates.filter((template) => {
  const integrationVersion = currentIntegration.version; // e.g., "v0mimir1" or "v1"

  // v1 integration → only v1 templates
  if (integrationVersion === 'v1') {
    return template.version === 'v1';
  }

  // v0mimir* integration → only v0mimir* templates
  if (integrationVersion?.startsWith('v0')) {
    return template.version?.startsWith('v0');
  }

  return false;
});
```

#### **Template Definition Page**

```tsx
// Show version badge
<Stack direction="row" gap={1}>
  <Text variant="h3">{template.name}</Text>
  <Badge
    text={template.version === 'v1' ? 'Grafana' : 'Mimir'}
    color={template.version === 'v1' ? 'green' : 'orange'}
  />
  <Badge text={template.version} color="neutral" />
</Stack>
```

### **Files to Modify:**

- `components/receivers/form/fields/TemplateSelector.tsx`
- `components/receivers/form/fields/TemplateContentAndPreview.tsx`
- Template definition pages

### **API Contract:**

Backend must provide `version` field in template objects.

### **Status:**

⏳ **Not in current POC** - Will be implemented in follow-up phase

---

## Decision 05: Version name for Mimir integrations

### **Decision:**

- `v1` → Grafana integrations
- `v0mimir1` → Mimir integrations (base)
- `v0mimir2` → Mimir msteamsv2 integration

### **Frontend Changes:**

#### **Version Badge Display**

```tsx
// Show full version string
<Badge
  text={integration.version.toUpperCase()}
  color={integration.version === 'v1' ? 'green' : 'orange'}
  tooltip={`Integration version: ${integration.version}`}
/>
```

#### **Version Detection**

```typescript
// Check if Mimir version
const isMimirVersion = version?.startsWith('v0mimir');
const isGrafanaVersion = version === 'v1';

// Check if legacy/deprecated
const isLegacy = version !== 'v1';
```

### **Files Modified:**

- ✅ `utils/notifier-versions-poc.ts` - Use `v0mimir1` instead of `v0`
- ✅ `ChannelSubForm.tsx` - Display correct version
- ✅ Mocks - Use `slack_v0mimir1` instead of `slack_v0`

### **Impact:**

- 🔄 **Version string changed** from `v0` to `v0mimir1`
- 📊 **More granular** versioning for future Mimir versions

---

## Summary Table

| Decision               | Frontend Impact             | Status    | Complexity |
| ---------------------- | --------------------------- | --------- | ---------- |
| **01: References**     | Disable staged in selectors | ⏳ Todo   | Low        |
| **02: Names**          | Show rename warning         | ⏳ Todo   | Low        |
| **03: Permissions**    | Hide Permissions button     | ⏳ Todo   | Low        |
| **04: Templates**      | Filter by version           | ⏳ Future | Medium     |
| **05: Version naming** | Use v0mimir1                | ✅ Done   | Low        |

---

## Implementation Priority

### **Phase 1: Current POC** ✅

- [x] Version naming (v0mimir1)
- [x] Integration versioning basics
- [x] Read-only state for Mimir integrations

### **Phase 2: Staged Receivers UI** ⏳

- [ ] Show "Staged" badge in contact points list
- [ ] Disable staged receivers in Routes/Rules selectors
- [ ] Hide "Permissions" button for staged receivers
- [ ] Show rename warnings for name collisions

### **Phase 3: Templates Versioning** ⏳

- [ ] Filter templates by integration version
- [ ] Show version in template pages
- [ ] Prevent v0 template creation via UI

---

## API Requirements

### **Receiver Object:**

```typescript
interface Receiver {
  name: string;
  // Existing fields...

  // New fields for staging:
  isStaged?: boolean; // Is this a staged receiver?
  willBeRenamed?: boolean; // Will be renamed on commit?
  suggestedName?: string; // New name after commit

  // Version info (already in POC):
  version?: string; // "v1" | "v0mimir1" | "v0mimir2"
  deprecated?: boolean;
  canCreate?: boolean;
}
```

### **Template Object:**

```typescript
interface Template {
  name: string;
  content: string;
  // Existing fields...

  // New fields:
  version?: string; // "v1" | "v0mimir1" | "v0mimir2"
  kind?: 'grafana' | 'mimir'; // Alternative to version
}
```

---

## Testing Checklist

### **Staged Receivers:**

- [ ] Staged receivers show "Staged" badge
- [ ] Cannot select staged receiver in Routes
- [ ] Cannot select staged receiver in Rules
- [ ] "Permissions" button hidden for staged
- [ ] Rename warning shows if name collision

### **Versioning:**

- [ ] v0mimir1 integrations show correct badge
- [ ] v1 integrations show correct badge
- [ ] Can change from v0mimir1 to v1 integration
- [ ] Fields read-only for v0mimir1
- [ ] Fields editable for v1

### **Templates:**

- [ ] v1 integration → only v1 templates in autocomplete
- [ ] v0mimir1 integration → only v0mimir\* templates
- [ ] Template page shows version badge

---

## Next Steps

1. ✅ Update POC with v0mimir1 naming
2. ⏳ Implement "Staged" badge in contact points list
3. ⏳ Disable staged receivers in Routes/Rules
4. ⏳ Hide Permissions button for staged
5. ⏳ Implement template versioning filtering

---

**Last Updated:** Based on design decisions approved Sep 2025
