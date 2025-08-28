---
description: Learn how to implement SCIM provisioning in Grafana for automated user and team synchronization. SCIM integrates with identity providers like Okta and Azure AD to streamline user management, automate team provisioning, and replace Team Sync.
keywords:
  - grafana
  - scim
  - provisioning
  - user-management
  - team-management
labels:
  products:
    - cloud
    - enterprise
menuTitle: Manage users and teams with SCIM
title: Manage users and teams with SCIM
weight: 310
---

# Manage users and teams with SCIM

{{< admonition type="note" >}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and to customers on select Grafana Cloud plans. For pricing information, visit [pricing](https://grafana.com/pricing/) or contact our sales team.
{{< /admonition >}}

{{< admonition type="warning" >}}
**Public Preview:** SCIM provisioning is currently in Public Preview. While functional, the feature is actively being refined and may undergo changes. We recommend thorough testing in non-production environments before deploying to production systems.
{{< /admonition >}}

SCIM streamlines identity management in Grafana by automating user lifecycle and team membership operations. This guide explains how SCIM works with existing Grafana setups, handles user provisioning, and manages team synchronization.

With SCIM, you can:

- **Automate user lifecycle** from creation to deactivation
- **Manage existing users** by linking them with identity provider identities
- **Automate team lifecycle** by automatically creating teams when groups are added, updating team memberships, and deleting teams when groups are removed
- **Maintain security** through automated deprovisioning
- **Replace Team Sync** with more robust SCIM group synchronization

## User provisioning with SCIM

SCIM provisioning works in conjunction with existing user management methods in Grafana. While SCIM automates user provisioning from the identity provider, users can still be created through SAML just-in-time provisioning when they log in, manually through the Grafana UI, or via automation tools like Terraform and the Grafana API. For the most consistent user management experience, we recommend centralizing user provisioning through SCIM.

{{< admonition type="note" >}}
User provisioning requires `user_sync_enabled = true` in the SCIM configuration. See [Configure SCIM in Grafana](../../configure-scim-provisioning#configure-scim-in-grafana) for more information.
{{< /admonition >}}

{{< admonition type="warning" >}}
After a user is provisioned through SCIM, they cannot be deleted from Grafana - they can only be deactivated through the identity provider. This is important to consider when planning your user management strategy, especially for compliance and data retention requirements.
{{< /admonition >}}

For detailed configuration steps specific to the identity provider, see:

- [Configure SCIM with Azure AD](../configure-scim-with-azuread/)
- [Configure SCIM with Okta](../configure-scim-with-okta/)

### How SCIM identifies users

SCIM uses a specific process to establish and maintain user identity between the identity provider and Grafana:

1. **Initial user lookup:**
   - The administrator configures SCIM at the Identity Provider, defining the **Unique identifier field**
   - The identity provider looks up each user in Grafana using this unique identifier field as a filter
   - The identity provider expects a single result from Grafana for each user

2. **Identity linking based on lookup results:**
   - **If there's a single matching result:** The identity provider retrieves the user's unique ID at Grafana, saves it, confirms it can fetch the user's information, and updates the user's information in Grafana
   - **If there are no matching results:** The identity provider attempts to create the user in Grafana. If successful, it retrieves and saves the user's unique ID for future operations. If a user with the same email address already exists in Grafana, the user is updated and will be managed by SCIM from that point forward.
   - The identity provider learns the relationship between the found Grafana user and the Grafana internal ID
   - The identity provider updates Grafana with the External ID
   - Grafana updates the authentication validations to expect this External ID

3. **Matching the User During Login:**
   When a user logs in via SAML, Grafana needs to securely match them to the correct user account provisioned by SCIM. This requires using a consistent, unique identifier across both processes (for example, the user's `objectId` in Azure AD).
   - **Configure SAML Claims:** Set up your identity provider (e.g., Azure AD) to include this unique identifier in the information it sends during SAML login.
   - **Configure Grafana SAML:** In the Grafana SAML settings, use the `assertion_attribute_login` setting to specify which incoming SAML attribute contains this unique identifier.
   - **Configure SCIM Mapping:** To complete the link, ensure your SCIM attribute mapping in the identity provider sets the user's Grafana **externalId** attribute to be the _same_ unique identifier provided via SAML (for example, the user's `objectId` in Azure AD).
   - See [SAML configuration details](../../configure-authentication/saml/#integrating-with-scim-provisioning) for specific configuration guidance.

This process ensures secure and consistent user identification across both systems, preventing security issues that could arise from email changes or other user attribute modifications.

### Existing Grafana users

For users who already exist in the Grafana instance:

- SCIM establishes the relationship through the External ID matching process
- Creates a secure link with the identity provider identity
- Preserves all existing settings and access
- Keeps the account active and unchanged until assigned in the identity provider

#### Handling users from other provisioning methods

To prevent conflicts and maintain consistent user management, disable or restrict other provisioning methods when implementing SCIM. This ensures that all new users are created through SCIM and prevents duplicate or conflicting user records.

- SAML Just-in-Time (JIT) provisioning:
  - Disable `allow_sign_up` in SAML settings to prevent automatic user creation
  - Existing JIT-provisioned users will continue to work but should be migrated to SCIM

- Terraform or API provisioning:
  - Stop creating new users through these methods
  - Existing users will continue to work but should be migrated to SCIM
  - Consider removing or archiving Terraform user creation resources

- Manual user creation:
  - Restrict UI-based user creation to administrators only
  - Plan to migrate manually created users to SCIM

### New users

For users who don't yet exist in Grafana:

- SCIM creates accounts when users are assigned to Grafana in the identity provider
- Sets up initial access based on identity provider group memberships and SAML role mapping
- No manual Grafana account creation needed

### Role management

SCIM handles user synchronization but not role assignments. Role management is handled through [Role Sync](../../configure-authentication/saml#configure-role-sync), and any role changes take effect during user authentication.

## Migrating existing users to SCIM provisioning

If you have an existing Grafana instance with manually created users and want to migrate to IDP-based SCIM provisioning, you can leverage the SCIM identification mechanism to seamlessly link existing users with their IDP identities.

### Migration overview

The migration process uses the same [user identification mechanism](#how-scim-identifies-users) described earlier, but focuses on linking existing Grafana users with their corresponding IDP identities rather than creating new users.

**Key benefits of this approach:**

- Preserves all existing user settings, dashboards, and permissions
- No disruption to user access during migration
- Gradual migration possible (users can be migrated in batches)
- Maintains audit trails and historical data

### Migration steps

1. **Prepare the identity provider:**
   - Ensure all existing Grafana users have corresponding accounts in your IDP
   - Verify that the unique identifier field (e.g., email, username, or object ID) matches between systems
   - Configure SCIM application in your IDP but don't assign users yet

2. **Configure SCIM in Grafana:**
   - Set up SCIM endpoint and authentication as described in [Configure SCIM in Grafana](../../configure-scim-provisioning#configure-scim-in-grafana)
   - Enable `user_sync_enabled = true`
   - Configure the unique identifier field to match your IDP setup

{{< admonition type="note" >}}
To restrict login access to only SCIM-provisioned users, enable the `[auth.scim][reject_non_provisioned_users]` option. Cloud Portal users can always sign in regardless of this setting.

```ini
[auth.scim]
reject_non_provisioned_users = true
```

{{< /admonition >}}

3. **Test the matching mechanism:**
   - Use the SCIM API to verify that existing users can be found using the unique identifier:

   ```bash
   curl --location 'https://{$GRAFANA_URL}/apis/scim.grafana.app/v0alpha1/namespaces/{$STACK_ID}/Users?filter=userName eq "existing.user@company.com"' \
   --header 'Authorization: Bearer glsa_xxxxxxxxxxxxxxxxxxxxxxxx'
   ```

   - This should return exactly one user record for each existing user

4. **Assign users in the IDP:**
   - Begin assigning existing users to the Grafana application in your IDP
   - The SCIM identification process will automatically link existing Grafana users with their IDP identities
   - Monitor the process for any conflicts or errors

5. **Verify the migration:**
   - Check that users can still access Grafana with their existing permissions
   - Verify that SAML/SSO login works correctly for migrated users
   - Ensure External ID is properly set for each migrated user

### Migration considerations

**Before migration:**

- **Backup your Grafana database** - Always have a recovery plan
- **Audit existing users** - Document current user accounts and their access levels
- **Plan for exceptions** - Some users might need manual intervention if unique identifiers don't match

**During migration:**

- **Monitor logs** - Watch for SCIM errors or conflicts during the linking process in Grafana and your Identity Provider
- **Batch processing** - Consider migrating users in small batches to identify issues early
- **Communication** - Inform users about the migration timeline and any required actions

**After migration:**

- **Disable manual provisioning** - Prevent new users from being created outside of SCIM
- **Update documentation** - Ensure team procedures reflect the new IDP-based workflow
- **Regular audits** - Periodically verify that IDP and Grafana users remain in sync

### Troubleshooting migration issues

**Multiple users found for unique identifier:**

- Review your unique identifier field configuration
- Check for duplicate accounts in Grafana or the IDP
- Consider using a more specific identifier (e.g., object ID instead of email)

**User not found during lookup:**

- Verify the unique identifier value matches exactly between systems
- Check that the user exists in both Grafana and the IDP

**Authentication failures after migration:**

- Confirm the SAML assertion `assertion_attribute_external_uid` includes the correct unique identifier
- Verify that your SAML configuration uses the same unique identifier for both SCIM and SAML authentication

## Team provisioning with SCIM

SCIM provides automated team management capabilities that go beyond what Team Sync offers. While Team Sync only maps identity provider groups to existing Grafana teams, SCIM can automatically create and delete teams based on group changes in the identity provider.

{{< admonition type="note" >}}
Team provisioning requires `group_sync_enabled = true` in the SCIM configuration. See [Configure SCIM in Grafana](../../configure-scim-provisioning#configure-scim-in-grafana) for more information.
{{< /admonition >}}

{{< admonition type="warning" >}}
Teams provisioned through SCIM cannot be deleted manually from Grafana - they can only be deleted by removing their corresponding groups from the identity provider.
{{< /admonition >}}

For detailed configuration steps specific to the identity provider, see:

- [Configure SCIM with Azure AD](../configure-scim-with-azuread/)
- [Configure SCIM with Okta](../configure-scim-with-okta/)

### SCIM vs Team Sync

{{< admonition type="warning" >}}
Do not enable both SCIM Group Sync and Team Sync simultaneously as these methods can conflict with each other. However, you can use SCIM for user provisioning while keeping Team Sync for team management until migration support is available.
{{< /admonition >}}

Choose one team synchronization method:

- If you enable SCIM Group Sync, disable Team Sync and use SCIM for team management
- If you prefer Team Sync, do not enable SCIM Group Sync

{{< admonition type="warning" >}}
**Team Sync Migration:** Support for migrating from Team Sync to SCIM Group Sync is coming soon. Until this support is released, we recommend keeping your existing Team Sync setup for team management. You can still benefit from SCIM user provisioning capabilities while using Team Sync for team management.
{{< /admonition >}}

### Key differences

SCIM Group Sync provides several advantages over Team Sync:

- **Automatic team creation:** SCIM automatically creates Grafana teams when new groups are added to the identity provider
- **Automatic team deletion:** SCIM removes teams when their corresponding groups are deleted from the identity provider
- **Real-time updates:** Team memberships are updated immediately when group assignments change
- **Simplified management:** No need to manually create teams in Grafana before mapping them

### How team synchronization works

SCIM manages teams through the following process:

Group assignment:

- User is assigned to groups in the identity provider
- SCIM detects group membership changes

Team creation and mapping:

- Creates Grafana teams for new identity provider groups
- Maps users to appropriate teams
- Removes users from teams when group membership changes

Team membership maintenance:

- Continuously syncs team memberships
- Removes users from teams when removed from groups
- Updates team memberships when groups change

## Next steps

- [Troubleshoot SCIM provisioning](../troubleshooting/)
- [Configure SCIM with Azure AD](../configure-scim-with-azuread/)
- [Configure SCIM with Okta](../configure-scim-with-okta/)
