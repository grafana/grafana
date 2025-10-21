---
description: Troubleshoot common SCIM provisioning issues in Grafana, including user provisioning, authentication, and login problems.
keywords:
  - grafana
  - scim
  - troubleshooting
  - user-provisioning
  - authentication
labels:
  products:
    - cloud
    - enterprise
menuTitle: Troubleshoot SCIM
title: Troubleshoot SCIM provisioning
weight: 400
---

# Troubleshoot SCIM provisioning

This page provides solutions for common issues you might encounter when configuring and using SCIM provisioning in Grafana.

## User provisioning issues

### Error: "invalid namespace"

**Cause:** The SCIM endpoint URL is incorrectly formatted.

**Solution:** Verify your URL follows the correct format:

```bash
https://{$GRAFANA_URL}/apis/scim.grafana.app/v0alpha1/namespaces/{$STACK_ID}/Users
```

Where:

- `{$GRAFANA_URL}` is your Grafana URL (subdomain format)
- `{$STACK_ID}` is your Grafana stack ID:
  - **Grafana Cloud:** Format like `stack-123` (found in your Grafana Cloud dashboard)
  - **On-premises:** Use `default` or the name of the organization

## Authentication issues

### Error: "HTTP 403 Forbidden"

**Cause:** Either incorrect token or insufficient permissions.

**Solution:**

1. **Check token:** Generate a new token from the Service Account details page
2. **Verify permissions:** Ensure the service account has `Editor` or `Admin` role in the Grafana instance

### Error: "HTTP 401 Unauthorized"

**Cause:** Invalid or expired authentication token.

**Solution:** Generate a new token from the Service Account details page in Grafana.

## Login issues

### Error: "User sync failed"

**Cause:** The user's unique identifier field is not correctly configured in SAML assertions.

**Solution:** Add the required SAML assertion based on your identity provider:

| SAML Assertion | Identity Provider | Value                            |
| -------------- | ----------------- | -------------------------------- |
| `userUID`      | Azure AD          | `objectId`                       |
| `userUID`      | Okta              | `user.getInternalProperty("id")` |

## Next steps

- [Manage users and teams with SCIM provisioning](../manage-users-teams/)
- [Configure SCIM with Azure AD](../configure-scim-with-azuread/)
- [Configure SCIM with Okta](../configure-scim-with-okta/)
