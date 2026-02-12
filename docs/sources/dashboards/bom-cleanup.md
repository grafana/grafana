# Cleaning Up Dashboards with Byte Order Marks (BOMs)

## Problem Overview

Some dashboards in production may contain Byte Order Mark (BOM) characters that cause validation errors. BOMs can come from:
- Frontend links editor component (known issue)
- Git repository files edited with certain text editors
- Legacy data imports

## Automatic Cleanup (Recommended)

**The admission mutation layer automatically strips BOMs** from dashboards during any Create/Update/Patch operation. This means:

✅ **New dashboards**: BOMs are automatically stripped during creation
✅ **Updated dashboards**: BOMs are automatically stripped when modified
✅ **Patched dashboards**: BOMs are automatically stripped during patches (like annotation changes)

### Passive Approach: Wait for Natural Updates

The simplest approach is to do nothing. As dashboards are naturally modified (e.g., by Git Sync, users, or other automation), the admission mutation will automatically clean them.

**Pros:**
- No manual intervention required
- No risk of unintended modifications
- Spreads cleanup over time (no load spike)

**Cons:**
- Some dashboards may never be cleaned if they're never modified
- Repository deletion may still fail for unmodified dashboards with BOMs

## Manual Cleanup Options

If you need to proactively clean all dashboards, use one of these approaches:

### Option 1: Kubectl Script (Simplest)

Use the provided shell script to scan and patch dashboards:

```bash
# Dry run (scan only, no changes)
cd /path/to/grafana
DRY_RUN=true NAMESPACE=default ./scripts/cleanup_bom_dashboards.sh

# Actual cleanup
DRY_RUN=false NAMESPACE=default ./scripts/cleanup_bom_dashboards.sh

# Clean specific dashboards by label
DRY_RUN=false NAMESPACE=default LABEL_SELECTOR="app=grafana" ./scripts/cleanup_bom_dashboards.sh
```

**What it does:**
1. Scans all dashboard versions (v0alpha1, v1beta1, v2alpha1, v2beta1)
2. Detects which dashboards contain BOMs
3. Patches each dashboard with BOMs (adds a temporary annotation)
4. The patch triggers admission mutation which strips the BOMs

**Requirements:**
- `kubectl` access to the cluster
- `jq` installed (for JSON parsing)
- Permissions to patch dashboard resources

### Option 2: Kubernetes Job (Automated)

For large-scale cleanup across multiple namespaces, create a Kubernetes Job:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: dashboard-bom-cleanup
  namespace: grafana
spec:
  template:
    spec:
      serviceAccountName: dashboard-cleanup-sa
      containers:
      - name: cleanup
        image: grafana/grafana:latest
        command:
        - /bin/bash
        - -c
        - |
          # Run cleanup script
          DRY_RUN=false NAMESPACE=${NAMESPACE} /scripts/cleanup_bom_dashboards.sh
        env:
        - name: NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
      restartPolicy: OnFailure
```

**ServiceAccount Requirements:**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: dashboard-cleanup-sa
  namespace: grafana
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: dashboard-cleanup-role
  namespace: grafana
rules:
- apiGroups: ["dashboard.grafana.app"]
  resources: ["dashboards"]
  verbs: ["get", "list", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dashboard-cleanup-binding
  namespace: grafana
subjects:
- kind: ServiceAccount
  name: dashboard-cleanup-sa
roleRef:
  kind: Role
  name: dashboard-cleanup-role
  apiGroup: rbac.authorization.k8s.io
```

### Option 3: Force Git Sync Reconciliation

If you're using Git Sync for provisioning, you can force a reconciliation:

```bash
# Delete and recreate the sync job to force full reconciliation
kubectl delete job -n grafana git-sync-job
kubectl create job -n grafana git-sync-job --from=cronjob/git-sync

# Or trigger reconciliation by updating the repository resource
kubectl annotate repository -n grafana <repo-name> \
  "provisioning.grafana.app/force-sync=$(date +%s)" --overwrite
```

This will re-sync all dashboards from Git, which will trigger the admission mutation to strip BOMs.

## Verification

### Check if a Specific Dashboard Has BOMs

```bash
# Get the dashboard and check for BOM characters
kubectl get dashboard.dashboard.grafana.app/v0alpha1 -n default <dashboard-name> -o json | \
  grep -c $'\xEF\xBB\xBF\|\uFEFF' || echo "No BOMs found"
```

### Verify Cleanup Success

After cleanup, verify that dashboards no longer have BOMs:

```bash
# Re-run the script in dry-run mode
DRY_RUN=true NAMESPACE=default ./scripts/cleanup_bom_dashboards.sh
```

If the output shows "No dashboards with BOMs found!", cleanup was successful.

## Impact and Considerations

### Performance Impact
- Each patch operation is lightweight (~1-5ms per dashboard)
- For large clusters (1000+ dashboards), run cleanup during off-peak hours
- Consider using label selectors to batch cleanup

### Safety
- ✅ **Idempotent**: Running cleanup multiple times is safe
- ✅ **Non-destructive**: Only removes invalid BOM characters
- ✅ **Reversible**: If needed, dashboards can be restored from Git
- ⚠️ **Triggers watches**: Patches will trigger any watchers/controllers

### Monitoring

Monitor cleanup progress:

```bash
# Count dashboards by version
kubectl get dashboard.dashboard.grafana.app/v0alpha1 -n default --no-headers | wc -l
kubectl get dashboard.dashboard.grafana.app/v1beta1 -n default --no-headers | wc -l
kubectl get dashboard.dashboard.grafana.app/v2alpha1 -n default --no-headers | wc -l
kubectl get dashboard.dashboard.grafana.app/v2beta1 -n default --no-headers | wc -l

# Check for recent patches (cleanup activity)
kubectl get dashboard.dashboard.grafana.app/v0alpha1 -n default \
  -o json | jq '.items[] | select(.metadata.annotations["dashboard.grafana.app/bom-cleanup"] != null) | .metadata.name'
```

## Troubleshooting

### Cleanup Script Fails

**Issue**: "kubectl: command not found"
```bash
# Install kubectl
# See: https://kubernetes.io/docs/tasks/tools/
```

**Issue**: "jq: command not found"
```bash
# Install jq
brew install jq  # macOS
apt-get install jq  # Ubuntu/Debian
yum install jq  # RHEL/CentOS
```

**Issue**: "Permission denied"
```bash
# Check RBAC permissions
kubectl auth can-i patch dashboard.dashboard.grafana.app/v0alpha1 -n default
```

### Dashboards Still Have BOMs After Cleanup

1. **Verify admission mutation is enabled**:
   ```bash
   kubectl get mutatingwebhookconfiguration | grep dashboard
   ```

2. **Check admission webhook logs**:
   ```bash
   kubectl logs -n grafana-system deployment/dashboard-webhook
   ```

3. **Manual test with a single dashboard**:
   ```bash
   kubectl patch dashboard.dashboard.grafana.app/v0alpha1 -n default <name> \
     --type=merge -p '{"metadata":{"annotations":{"test":"cleanup"}}}'
   ```

## FAQ

**Q: Will this affect dashboard functionality?**
A: No. BOMs are invisible characters that have no semantic meaning. Removing them has no effect on dashboard behavior.

**Q: How long does cleanup take?**
A: Approximately 10-50ms per dashboard, depending on dashboard size. For 1000 dashboards, expect 10-50 seconds total.

**Q: Can I run cleanup in multiple namespaces?**
A: Yes. Run the script once per namespace:
```bash
for ns in namespace1 namespace2 namespace3; do
  DRY_RUN=false NAMESPACE=$ns ./scripts/cleanup_bom_dashboards.sh
done
```

**Q: What if a dashboard is being actively edited during cleanup?**
A: The patch will be applied atomically. If there's a conflict, Kubernetes will retry. The dashboard editor will need to refresh to see the annotation change.

**Q: Do I need to restart anything after cleanup?**
A: No. The cleanup is transparent and requires no restarts.

## Summary

**For most users**: Do nothing. The automatic cleanup in admission mutation will handle BOMs transparently as dashboards are modified.

**For proactive cleanup**: Run the kubectl script once to clean all existing dashboards with BOMs.

**For automated cleanup**: Deploy the Kubernetes Job to run cleanup on a schedule or one-time basis.
